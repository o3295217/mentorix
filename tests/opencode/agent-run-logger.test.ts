import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { describe, expect, it, vi } from 'vitest'
import {
  createAgentRunLogger,
  getDefaultJournalPath,
  isTaskTool,
  parseTaskOutput,
  resolveModel,
  resolveScenario,
  sanitizeDescription,
  type AgentRunRecord,
} from '../../.opencode/lib/agent-run-logger-core'
import { createAgentRunLoggerHooks } from '../../.opencode/plugin/agent-run-logger'

const execFileAsync = promisify(execFile)

describe('opencode agent run logger', () => {
  it('detects task tool ids and namespaced variants', () => {
    expect(isTaskTool({ tool: 'task' })).toBe(true)
    expect(isTaskTool({ tool: { id: 'opencode.task' } })).toBe(true)
    expect(isTaskTool({ name: 'provider/task' })).toBe(true)
    expect(isTaskTool({ tool: 'bash' })).toBe(false)
  })

  it('sanitizes description and resolves base/GPT scenarios and models', () => {
    expect(sanitizeDescription('hello\nsecret sk-1234567890abcdef user@test.com')).toBe('hello secret [redacted] [email]')
    expect(resolveScenario({ model: 'anthropic/claude-fable-5' })).toBe('base')
    expect(resolveScenario({ model: 'openai/gpt-5.6-sol', agent: { lead: { model: 'openai/gpt-5.6-sol' } } })).toBe('agent2.0_gpt56')
    expect(resolveScenario({ model: 'openai/other' })).toBe('custom')
    expect(resolveModel({ model: 'default/model', agent: { backend: { model: 'agent/model' } } }, 'backend')).toBe('agent/model')
    expect(resolveModel({ model: 'default/model' }, 'backend')).toBe('default/model')
  })

  it('parses completed, error and unknown outputs without throwing', () => {
    expect(parseTaskOutput({ output: '<task id="t1" state="completed">', task_result: 'do not log' })).toEqual({ returnedTaskId: 't1', state: 'completed' })
    expect(parseTaskOutput('<task id="t2" state="error">')).toEqual({ returnedTaskId: 't2', state: 'error' })
    expect(parseTaskOutput({ result: 'no task xml here' })).toEqual({ returnedTaskId: null, state: 'unknown' })
  })

  it('writes safe started/finished JSONL records including resume fields', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-logger-'))
    try {
      const journalPath = join(dir, 'agent-runs.jsonl')
      let time = 1_700_000_000_000
      const logger = createAgentRunLogger({ journalPath, now: () => new Date((time += 50)) })

      await logger.started(
        {
          tool: 'task',
          callId: 'call-1',
          sessionId: 'session-1',
          args: {
            description: 'Короткая задача with command rm -rf / and prompt text',
            prompt: 'must not be logged',
            command: 'must not be logged',
            subagent_type: 'backend',
            task_id: 'previous-task',
          },
        },
        { model: 'openai/gpt-5.6-sol', agent: { backend: { model: 'openai/gpt-5.5' }, lead: { model: 'openai/gpt-5.6-sol' } } },
      )
      await logger.finished({ tool: 'task', callId: 'call-1' }, { output: '<task id="new-task" state="completed">', task_result: 'SECRET OUTPUT' })
      await logger.flush()

      const records = await readJournal(journalPath)
      expect(records).toHaveLength(2)
      expect(records[0]).toMatchObject({ event: 'started', isResume: true, resumedTaskId: 'previous-task', agent: 'backend', resolvedModel: 'openai/gpt-5.5', scenario: 'agent2.0_gpt56' })
      expect(records[1]).toMatchObject({ event: 'finished', returnedTaskId: 'new-task', state: 'completed', durationMs: 50 })
      const raw = await readFile(journalPath, 'utf8')
      expect(raw).not.toContain('must not be logged')
      expect(raw).not.toContain('SECRET OUTPUT')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('adapts real before(input, output) hook contract and reads args from output.args', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-hook-'))
    try {
      const hooks = await createAgentRunLoggerHooks({ worktree: dir })
      await hooks.config?.({ model: 'openai/gpt-5.6-sol', agent: { lead: { model: 'openai/gpt-5.6-sol' }, backend: { model: 'openai/gpt-5.5' } } })

      await hooks['tool.execute.before']?.(
        { tool: 'task', sessionID: 'session-real', callID: 'call-real' },
        {
          args: {
            description: 'Реальный контракт before hook',
            subagent_type: 'backend',
            task_id: 'resume-real',
            prompt: 'must not be logged from output.args',
          },
        },
      )
      await hooks['tool.execute.after']?.(
        {
          tool: 'task',
          sessionID: 'session-real',
          callID: 'call-real',
          args: { description: 'after args stay available', subagent_type: 'backend', task_id: 'resume-real' },
        },
        { title: 'task', output: '<task id="returned-real" state="completed">', metadata: { task_result: 'must not be logged' } },
      )

      const journalPath = getDefaultJournalPath(dir)
      const records = await readJournal(journalPath)
      expect(records[0]).toMatchObject({
        event: 'started',
        parentSessionId: 'session-real',
        callId: 'call-real',
        description: 'Реальный контракт before hook',
        agent: 'backend',
        resolvedModel: 'openai/gpt-5.5',
        scenario: 'agent2.0_gpt56',
        isResume: true,
        resumedTaskId: 'resume-real',
      })
      expect(records[1]).toMatchObject({ event: 'finished', returnedTaskId: 'returned-real', state: 'completed' })
      const raw = await readFile(journalPath, 'utf8')
      expect(raw).not.toContain('must not be logged')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('builds journal path from top-level PluginInput worktree before directory fallback', async () => {
    const worktree = join(tmpdir(), 'opencode-worktree')
    const directory = join(tmpdir(), 'opencode-directory')
    const logger = createAgentRunLogger({ journalPath: join(tmpdir(), 'unused.jsonl') })
    const loggerFactory = vi.fn(() => logger)

    await createAgentRunLoggerHooks({ worktree, directory }, loggerFactory)

    expect(loggerFactory).toHaveBeenCalledWith(getDefaultJournalPath(worktree))
    expect(loggerFactory).not.toHaveBeenCalledWith(getDefaultJournalPath(directory))
  })

  it('serializes concurrent appends into valid JSONL', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-logger-'))
    try {
      const journalPath = join(dir, 'agent-runs.jsonl')
      const logger = createAgentRunLogger({ journalPath })
      await Promise.all(
        Array.from({ length: 20 }, (_, index) => logger.started(
          { tool: 'namespace.task', callId: `call-${index}`, args: { description: `task ${index}`, subagent_type: 'junior' } },
          { model: 'anthropic/claude-fable-5' },
        )),
      )
      await logger.flush()
      const rawLines = (await readFile(journalPath, 'utf8')).trim().split('\n')
      expect(rawLines).toHaveLength(20)
      expect(rawLines.every((line) => JSON.parse(line).event === 'started')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('aggregates stats and tolerates missing or broken lines', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-stats-'))
    try {
      const missing = await execFileAsync('node', ['scripts/opencode-agent-stats.mjs', join(dir, 'missing.jsonl')])
      expect(missing.stdout).toContain('not found')

      const journalPath = join(dir, 'agent-runs.jsonl')
      await writeFile(journalPath, [
        JSON.stringify({ event: 'started', agent: 'backend', resolvedModel: 'm1', scenario: 'base', isResume: false }),
        JSON.stringify({ event: 'finished', agent: 'backend', resolvedModel: 'm1', scenario: 'base', state: 'completed', durationMs: 100 }),
        JSON.stringify({ event: 'started', agent: 'backend', resolvedModel: 'm1', scenario: 'base', isResume: true }),
        JSON.stringify({ event: 'finished', agent: 'backend', resolvedModel: 'm1', scenario: 'base', state: 'error', durationMs: 300 }),
        JSON.stringify({ event: 'started', agent: 'junior', resolvedModel: 'm2', scenario: 'custom', isResume: false }),
        '{broken',
      ].join('\n'))

      const result = await execFileAsync('node', ['scripts/opencode-agent-stats.mjs', journalPath])
      expect(result.stdout).toContain('backend\tm1\tbase\t2\t2\t1\t1\t0\t1\t50.0%\t200')
      expect(result.stdout).toContain('junior\tm2\tcustom\t1\t0\t0\t0\t1\t0\t0.0%\t0')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

async function readJournal(path: string): Promise<AgentRunRecord[]> {
  return (await readFile(path, 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as AgentRunRecord)
}
