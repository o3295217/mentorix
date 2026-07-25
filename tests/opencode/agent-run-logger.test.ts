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
import { createAgentRunLoggerHooks } from '../../.opencode/lib/agent-run-logger-hooks'
import * as pluginModule from '../../.opencode/plugin/agent-run-logger'

const execFileAsync = promisify(execFile)

describe('opencode agent run logger', () => {
  it('documents the OpenCode legacy loader root cause for duplicate hook registration', async () => {
    const hookFactory = vi.fn(async (_input: unknown) => ({
      'tool.execute.before': async () => undefined,
      'tool.execute.after': async () => undefined,
    }))
    const legacyModule = {
      default: async (input: unknown) => hookFactory(input),
      createAgentRunLoggerHooks: hookFactory,
      resolveWorktree: () => '/tmp/project',
    }

    const legacyExports = collectLegacyServerPlugins(legacyModule)
    const legacyHookObjects = (await Promise.all(legacyExports.map((plugin) => plugin({ worktree: '/tmp/project' })))).filter(isHookObject)
    const currentExports = collectLegacyServerPlugins(pluginModule)

    expect(legacyExports).toHaveLength(3)
    expect(legacyHookObjects).toHaveLength(2)
    expect(currentExports).toHaveLength(1)
  })

  it('keeps autodiscovered plugin module to a single default function export', () => {
    const functionExports = Object.entries(pluginModule)
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => name)

    expect(functionExports).toEqual(['default'])
  })

  it('detects task tool ids and namespaced variants', () => {
    expect(isTaskTool({ tool: 'task' })).toBe(true)
    expect(isTaskTool({ tool: { id: 'opencode.task' } })).toBe(true)
    expect(isTaskTool({ name: 'provider/task' })).toBe(true)
    expect(isTaskTool({ tool: 'bash' })).toBe(false)
  })

  it('sanitizes description and resolves base/GPT scenarios and models', () => {
    expect(sanitizeDescription('hello\nsecret sk-1234567890abcdef user@test.com')).toBe('hello secret [redacted] [email]')
    expect(resolveScenario({ model: 'anthropic/claude-fable-5' })).toBe('base')
    expect(resolveScenario(fullGpt56Config())).toBe('agent2.0_gpt56')
    expect(resolveScenario({ ...fullGpt56Config(), agent: { ...fullGpt56Config().agent, 'research-free': { model: 'opencode/nemotron-3-ultra-free' }, 'agent-auditor': { model: 'opencode/nemotron-3-ultra-free' } } })).toBe('agent2.0_gpt56')
    expect(resolveScenario(fullBalancedConfig())).toBe('agent2.0_balanced')
    expect(resolveScenario({ ...fullBalancedConfig(), agent: { ...fullBalancedConfig().agent, backend: { model: 'openai/gpt-5.4-mini', variant: 'high' } } })).toBe('custom')
    expect(resolveScenario({ ...fullBalancedConfig(), agent: { ...fullBalancedConfig().agent, reviewer: { model: 'openai/gpt-5.5', variant: 'medium' } } })).toBe('custom')
    expect(resolveScenario({ model: 'openai/gpt-5.6-sol', agent: { lead: { model: 'openai/gpt-5.6-sol' }, explore: { model: 'opencode/north-mini-code-free' }, 'research-free': { model: 'opencode/nemotron-3-ultra-free' } } })).toBe('custom')
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
        fullGpt56Config(),
      )
      await logger.finished({ tool: 'task', callId: 'call-1' }, { output: '<task id="new-task" state="completed">', task_result: 'SECRET OUTPUT' })
      await logger.flush()

      const records = await readJournal(journalPath)
      expect(records).toHaveLength(2)
      expect(records[0]).toMatchObject({ event: 'started', isResume: true, resumedTaskId: 'previous-task', agent: 'backend', resolvedModel: 'openai/gpt-5.5', scenario: 'agent2.0_gpt56' })
      expect(records[1]).toMatchObject({ event: 'finished', returnedTaskId: 'new-task', state: 'completed', durationMs: 50 })
      expect(records[1]).toMatchObject({ usageAvailable: false, inputTokens: null, cost: null })
      const raw = await readFile(journalPath, 'utf8')
      expect(raw).not.toContain('must not be logged')
      expect(raw).not.toContain('SECRET OUTPUT')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('excludes agent-auditor operational audit calls from lifecycle logging', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-auditor-exclusion-'))
    try {
      const journalPath = join(dir, 'agent-runs.jsonl')
      const logger = createAgentRunLogger({ journalPath })

      await logger.started({ tool: 'task', callId: 'call-auditor', args: { description: 'audit', subagent_type: 'agent-auditor' } }, fullBalancedConfig())
      await logger.finished({ tool: 'task', callId: 'call-auditor', args: { subagent_type: 'agent-auditor' } }, { output: '<task id="audit-task" state="completed">' })
      await logger.flush()
      await expect(readFile(journalPath, 'utf8')).rejects.toThrow()

      await logger.started({ tool: 'task', callId: 'call-backend', args: { description: 'normal', subagent_type: 'backend' } }, fullBalancedConfig())
      await logger.finished({ tool: 'task', callId: 'call-backend', args: { subagent_type: 'backend' } }, { output: '<task id="backend-task" state="completed">' })
      await logger.flush()

      const records = await readJournal(journalPath)
      expect(records).toHaveLength(2)
      expect(records[0]).toMatchObject({ event: 'started', agent: 'backend', scenario: 'agent2.0_balanced' })
      expect(records[1]).toMatchObject({ event: 'finished', agent: 'backend', scenario: 'agent2.0_balanced' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('excludes agent-auditor calls through plugin hooks while logging neighboring agents', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-auditor-hook-exclusion-'))
    try {
      const hooks = await createAgentRunLoggerHooks({ worktree: dir })
      await hooks.config?.(fullBalancedConfig())

      await hooks['tool.execute.before']?.({ tool: 'task', sessionID: 'parent', callID: 'call-auditor-hook' }, { args: { description: 'audit', subagent_type: 'agent-auditor' } })
      await hooks['tool.execute.after']?.({ tool: 'task', sessionID: 'parent', callID: 'call-auditor-hook', args: { subagent_type: 'agent-auditor' } }, { title: 'task', output: '<task id="audit-hook" state="completed">', metadata: {} })
      await expect(readFile(getDefaultJournalPath(dir), 'utf8')).rejects.toThrow()

      await hooks['tool.execute.before']?.({ tool: 'task', sessionID: 'parent', callID: 'call-backend-hook' }, { args: { description: 'normal', subagent_type: 'backend' } })
      await hooks['tool.execute.after']?.({ tool: 'task', sessionID: 'parent', callID: 'call-backend-hook', args: { subagent_type: 'backend' } }, { title: 'task', output: '<task id="backend-hook" state="completed">', metadata: {} })

      const records = await readJournal(getDefaultJournalPath(dir))
      expect(records).toHaveLength(2)
      expect(records[0]).toMatchObject({ event: 'started', agent: 'backend', scenario: 'agent2.0_balanced' })
      expect(records[1]).toMatchObject({ event: 'finished', agent: 'backend', scenario: 'agent2.0_balanced' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('cleans excluded auditor child usage so bounded caches do not evict ordinary agent usage', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-auditor-cleanup-'))
    try {
      const hooks = await createAgentRunLoggerHooks({ worktree: dir })
      await hooks.config?.(fullBalancedConfig())

      await hooks['tool.execute.before']?.({ tool: 'task', sessionID: 'parent', callID: 'call-kept' }, { args: { description: 'normal kept', subagent_type: 'backend' } })
      await hooks.event?.({ event: { type: 'session.created', properties: { info: childSession('child-kept') } } })
      await hooks.event?.({ event: { type: 'message.updated', properties: { info: assistantMessage('child-kept', 'm-kept', { input: 7, output: 8, reasoning: 0, cache: { read: 0, write: 0 } }, 0.07) } } })

      for (let index = 0; index < 300; index += 1) {
        const childId = `audit-child-${index}`
        await hooks['tool.execute.before']?.({ tool: 'task', sessionID: 'parent', callID: `call-audit-${index}` }, { args: { description: 'audit', subagent_type: 'agent-auditor' } })
        await hooks.event?.({ event: { type: 'session.created', properties: { info: childSession(childId) } } })
        await hooks.event?.({ event: { type: 'message.updated', properties: { info: assistantMessage(childId, `m-audit-${index}`, { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }, 0.001) } } })
        await hooks['tool.execute.after']?.({ tool: 'task', sessionID: 'parent', callID: `call-audit-${index}`, args: { subagent_type: 'agent-auditor' } }, { title: 'task', output: `<task id="${childId}" state="completed">`, metadata: { task_result: 'must not be logged' } })
      }

      await hooks['tool.execute.after']?.({ tool: 'task', sessionID: 'parent', callID: 'call-kept', args: { subagent_type: 'backend' } }, { title: 'task', output: '<task id="child-kept" state="completed">', metadata: {} })

      const records = await readJournal(getDefaultJournalPath(dir))
      expect(records).toHaveLength(2)
      expect(records[0]).toMatchObject({ event: 'started', agent: 'backend' })
      expect(records[1]).toMatchObject({ event: 'finished', agent: 'backend', usageAvailable: true, totalTokens: 15, cost: 0.07 })
      const raw = await readFile(getDefaultJournalPath(dir), 'utf8')
      expect(raw).not.toContain('agent-auditor')
      expect(raw).not.toContain('must not be logged')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('writes balanced scenario lifecycle records when overlay fingerprint is present', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-balanced-'))
    try {
      const journalPath = join(dir, 'agent-runs.jsonl')
      const logger = createAgentRunLogger({ journalPath })

      await logger.started(
        { tool: 'task', callId: 'call-balanced', sessionId: 'session-balanced', args: { description: 'balanced scenario', subagent_type: 'backend' } },
        fullBalancedConfig(),
      )
      await logger.finished({ tool: 'task', callId: 'call-balanced' }, { output: '<task id="balanced-task" state="completed">' })
      await logger.flush()

      const records = await readJournal(journalPath)
      expect(records[0]).toMatchObject({ event: 'started', scenario: 'agent2.0_balanced', resolvedModel: 'openai/gpt-5.5' })
      expect(records[1]).toMatchObject({ event: 'finished', scenario: 'agent2.0_balanced', state: 'completed' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('aggregates latest cumulative usage once per assistant message in returned child session', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-usage-'))
    try {
      const journalPath = join(dir, 'agent-runs.jsonl')
      const logger = createAgentRunLogger({ journalPath })

      await logger.started({ tool: 'task', callId: 'call-usage', sessionId: 'parent', args: { description: 'usage', subagent_type: 'backend' } }, { model: 'anthropic/claude-fable-5' })
      await logger.event({ event: { type: 'message.updated', message: assistantMessage('child-1', 'm1', { input: 10, output: 3, reasoning: 1, cache: { read: 2, write: 4 } }, 0.01) } })
      await logger.event({ event: { type: 'message.updated', message: assistantMessage('child-1', 'm1', { input: 20, output: 6, reasoning: 2, cache: { read: 4, write: 8 } }, 0.02) } })
      await logger.event({ event: { type: 'message.updated', message: assistantMessage('child-1', 'm2', { input: 5, output: 7, reasoning: 0, cache: { read: 1, write: 0 } }, 0.03) } })
      await logger.finished({ tool: 'task', callId: 'call-usage' }, { output: '<task id="child-1" state="completed">' })
      await logger.flush()

      const records = await readJournal(journalPath)
      expect(records[1]).toMatchObject({
        event: 'finished',
        usageAvailable: true,
        usageMessageCount: 2,
        inputTokens: 25,
        outputTokens: 13,
        reasoningTokens: 2,
        cacheReadTokens: 5,
        cacheWriteTokens: 8,
        totalTokens: 38,
        cost: 0.05,
        usageModelId: 'openai/gpt-5.5',
        usageProviderId: 'openai',
        usageMode: 'subagent',
      })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('isolates usage between child sessions and reports unknown when usage is absent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-usage-isolation-'))
    try {
      const journalPath = join(dir, 'agent-runs.jsonl')
      const logger = createAgentRunLogger({ journalPath })

      await logger.event({ event: { type: 'message.updated', message: assistantMessage('child-a', 'm1', { input: 11, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }, 0.11) } })
      await logger.event({ event: { type: 'message.updated', message: assistantMessage('child-b', 'm1', { input: 22, output: 2, reasoning: 0, cache: { read: 0, write: 0 } }, 0.22) } })
      await logger.started({ tool: 'task', callId: 'call-a', args: { description: 'a', subagent_type: 'backend' } }, { model: 'anthropic/claude-fable-5' })
      await logger.finished({ tool: 'task', callId: 'call-a' }, { output: '<task id="child-a" state="completed">' })
      await logger.started({ tool: 'task', callId: 'call-missing', args: { description: 'missing', subagent_type: 'backend' } }, { model: 'anthropic/claude-fable-5' })
      await logger.finished({ tool: 'task', callId: 'call-missing' }, { output: '<task id="child-missing" state="completed">' })
      await logger.flush()

      const records = await readJournal(journalPath)
      expect(records[1]).toMatchObject({ returnedTaskId: 'child-a', usageAvailable: true, inputTokens: 11, outputTokens: 1, cost: 0.11 })
      expect(records[3]).toMatchObject({ returnedTaskId: 'child-missing', usageAvailable: false, inputTokens: null, outputTokens: null, cost: null })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('captures usage through plugin event hook for base, GPT, balanced and custom scenarios', async () => {
    const scenarios = [
      { config: { model: 'anthropic/claude-fable-5' }, scenario: 'base' },
      { config: fullGpt56Config(), scenario: 'agent2.0_gpt56' },
      { config: fullBalancedConfig(), scenario: 'agent2.0_balanced' },
      { config: { model: 'local/custom' }, scenario: 'custom' },
    ]

    for (const item of scenarios) {
      const dir = await mkdtemp(join(tmpdir(), 'agent-run-hook-usage-'))
      try {
        const hooks = await createAgentRunLoggerHooks({ worktree: dir })
        await hooks.config?.(item.config)
        await hooks['tool.execute.before']?.({ tool: 'task', sessionID: 'parent', callID: 'call' }, { args: { description: 'same logger', subagent_type: 'backend' } })
        await hooks.event?.({ event: { type: 'message.updated', properties: { info: assistantMessage('child-hook', 'm1', { input: 1, output: 2, reasoning: 3, cache: { read: 4, write: 5 } }, 0.015) } } })
        await hooks['tool.execute.after']?.({ tool: 'task', sessionID: 'parent', callID: 'call', args: { description: 'same logger', subagent_type: 'backend' } }, { title: 'task', output: '<task id="child-hook" state="completed">', metadata: {} })

        const records = await readJournal(getDefaultJournalPath(dir))
        expect(records[0].scenario).toBe(item.scenario)
        expect(records[1]).toMatchObject({ scenario: item.scenario, usageAvailable: true, totalTokens: 3, cost: 0.015 })
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    }
  })

  it('uses session lifecycle and bounded eviction so parent/unmatched usage cannot grow forever', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-memory-'))
    try {
      const journalPath = join(dir, 'agent-runs.jsonl')
      const logger = createAgentRunLogger({ journalPath })

      await logger.event({ event: { type: 'session.created', properties: { info: { id: 'child-kept', parentID: 'parent', projectID: 'p', directory: dir, title: 'child', version: '1', time: { created: 1, updated: 1 } } } } })
      await logger.event({ event: { type: 'message.updated', properties: { info: assistantMessage('child-kept', 'm1', { input: 7, output: 8, reasoning: 0, cache: { read: 0, write: 0 } }, 0.07) } } })

      for (let index = 0; index < 90; index += 1) {
        await logger.event({ event: { type: 'message.updated', properties: { info: assistantMessage(`parent-or-unmatched-${index}`, `m-${index}`, { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }, 0.001) } } })
      }

      expect(logger.getMemoryStats()).toEqual({ startedCallCount: 0, usageSessionCount: 65, unmatchedUsageSessionCount: 64, childUsageSessionCount: 1, pendingChildSessionCount: 0 })

      await logger.started({ tool: 'task', callId: 'call-kept', args: { description: 'kept child', subagent_type: 'backend' } }, { model: 'anthropic/claude-fable-5' })
      await logger.finished({ tool: 'task', callId: 'call-kept' }, { output: '<task id="child-kept" state="completed">' })
      await logger.flush()

      const records = await readJournal(journalPath)
      expect(records[1]).toMatchObject({ returnedTaskId: 'child-kept', usageAvailable: true, totalTokens: 15, cost: 0.07 })
      expect(logger.getMemoryStats().childUsageSessionCount).toBe(0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('cleans tracked child usage on typed session.deleted events', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-session-delete-'))
    try {
      const logger = createAgentRunLogger({ journalPath: join(dir, 'agent-runs.jsonl') })
      const session = { id: 'deleted-child', parentID: 'parent', projectID: 'p', directory: dir, title: 'child', version: '1', time: { created: 1, updated: 1 } }
      await logger.event({ event: { type: 'session.created', properties: { info: session } } })
      await logger.event({ event: { type: 'message.updated', properties: { info: assistantMessage('deleted-child', 'm1', { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }, 0.01) } } })
      expect(logger.getMemoryStats().usageSessionCount).toBe(1)
      await logger.event({ event: { type: 'session.deleted', properties: { info: session } } })
      expect(logger.getMemoryStats()).toEqual({ startedCallCount: 0, usageSessionCount: 0, unmatchedUsageSessionCount: 0, childUsageSessionCount: 0, pendingChildSessionCount: 0 })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('bounds pending child sessions without messages and evicts session indexes consistently', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-child-bounds-'))
    try {
      const journalPath = join(dir, 'agent-runs.jsonl')
      const logger = createAgentRunLogger({ journalPath })

      for (let index = 0; index < 400; index += 1) {
        await logger.event({ event: { type: 'session.created', properties: { info: { id: `child-${index}`, parentID: 'parent', projectID: 'p', directory: dir, title: 'child', version: '1', time: { created: index, updated: index } } } } })
      }

      expect(logger.getMemoryStats()).toEqual({ startedCallCount: 0, usageSessionCount: 0, unmatchedUsageSessionCount: 0, childUsageSessionCount: 0, pendingChildSessionCount: 256 })

      for (let index = 0; index < 400; index += 1) {
        await logger.event({ event: { type: 'message.updated', properties: { info: assistantMessage(`child-${index}`, `m-${index}`, { input: 1, output: 2, reasoning: 0, cache: { read: 0, write: 0 } }, 0.001) } } })
      }

      expect(logger.getMemoryStats()).toEqual({ startedCallCount: 0, usageSessionCount: 256, unmatchedUsageSessionCount: 0, childUsageSessionCount: 256, pendingChildSessionCount: 0 })

      await logger.started({ tool: 'task', callId: 'call-last', args: { description: 'last child', subagent_type: 'backend' } }, { model: 'anthropic/claude-fable-5' })
      await logger.finished({ tool: 'task', callId: 'call-last' }, { output: '<task id="child-399" state="completed">' })
      await logger.flush()

      const records = await readJournal(journalPath)
      expect(records[1]).toMatchObject({ returnedTaskId: 'child-399', usageAvailable: true, totalTokens: 3, cost: 0.001 })
      expect(logger.getMemoryStats()).toEqual({ startedCallCount: 0, usageSessionCount: 255, unmatchedUsageSessionCount: 0, childUsageSessionCount: 255, pendingChildSessionCount: 0 })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('does not persist prompt, output or secret fields from message events', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-secret-'))
    try {
      const journalPath = join(dir, 'agent-runs.jsonl')
      const logger = createAgentRunLogger({ journalPath })
      await logger.started({ tool: 'task', callId: 'call-secret', args: { description: 'secret check', subagent_type: 'backend' } }, { model: 'anthropic/claude-fable-5' })
      await logger.event({ event: { type: 'message.updated', message: { ...assistantMessage('child-secret', 'm1', { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }, 0.001), prompt: 'sk-verysecret123456', output: 'SECRET OUTPUT' } } })
      await logger.finished({ tool: 'task', callId: 'call-secret' }, { output: '<task id="child-secret" state="completed">' })
      await logger.flush()

      const raw = await readFile(journalPath, 'utf8')
      expect(raw).not.toContain('sk-verysecret123456')
      expect(raw).not.toContain('SECRET OUTPUT')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('adapts real before(input, output) hook contract and reads args from output.args', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-hook-'))
    try {
      const hooks = await createAgentRunLoggerHooks({ worktree: dir })
      await hooks.config?.(fullGpt56Config())

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
      expect(result.stdout).toContain('backend\tm1\tbase\t2\t2\t1\t1\t0\t1\t50.0%\t50.0%\t200\t0.0%\t0\t0\t0\t0\t0\t0\t0\t0\t0')
      expect(result.stdout).toContain('junior\tm2\tcustom\t1\t0\t0\t0\t1\t0\t0.0%\t0.0%\t0\t0.0%\t0\t0\t0\t0\t0\t0\t0\t0\t0')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('stats read schema v2 usage sums while keeping schema v1 rows readable', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-stats-v2-'))
    try {
      const journalPath = join(dir, 'agent-runs.jsonl')
      await writeFile(journalPath, [
        JSON.stringify({ schemaVersion: 1, event: 'finished', agent: 'backend', resolvedModel: 'm1', scenario: 'base', state: 'completed', durationMs: 100 }),
        JSON.stringify({ schemaVersion: 2, event: 'finished', agent: 'backend', resolvedModel: 'm1', scenario: 'base', state: 'completed', durationMs: 200, usageAvailable: true, cost: 0.12, totalTokens: 42, inputTokens: 10, outputTokens: 20, reasoningTokens: 3, cacheReadTokens: 4, cacheWriteTokens: 5 }),
      ].join('\n'))

      const result = await execFileAsync('node', ['scripts/opencode-agent-stats.mjs', journalPath])
      expect(result.stdout).toContain('backend\tm1\tbase\t0\t2\t2\t0\t0\t0\t100.0%\t0.0%\t150\t50.0%\t0.12\t0.12\t42\t42\t10\t20\t3\t4\t5')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('stats aggregate the balanced scenario string without special handling', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-stats-balanced-'))
    try {
      const journalPath = join(dir, 'agent-runs.jsonl')
      await writeFile(journalPath, [
        JSON.stringify({ schemaVersion: 2, event: 'started', parentSessionId: 'parent', callId: 'call-balanced-stats', agent: 'backend', resolvedModel: 'openai/gpt-5.5', scenario: 'agent2.0_balanced', isResume: true }),
        JSON.stringify({ schemaVersion: 2, event: 'finished', parentSessionId: 'parent', callId: 'call-balanced-stats', agent: 'backend', resolvedModel: 'openai/gpt-5.5', scenario: 'agent2.0_balanced', state: 'completed', durationMs: 100, usageAvailable: true, totalTokens: 42, inputTokens: 10, outputTokens: 20, reasoningTokens: 3, cacheReadTokens: 4, cacheWriteTokens: 5, cost: 0.12 }),
      ].join('\n'))

      const result = await execFileAsync('node', ['scripts/opencode-agent-stats.mjs', journalPath])
      expect(result.stdout).toContain('backend\topenai/gpt-5.5\tagent2.0_balanced\t1\t1\t1\t0\t0\t1\t100.0%\t0.0%\t100\t100.0%\t0.12\t0.12\t42\t42\t10\t20\t3\t4\t5')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('deduplicates historical duplicated lifecycle rows before stats aggregation', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-run-stats-dedup-'))
    try {
      const journalPath = join(dir, 'agent-runs.jsonl')
      await writeFile(journalPath, [
        JSON.stringify({ schemaVersion: 2, event: 'started', parentSessionId: 'parent-a', callId: 'call-dup', agent: 'backend', resolvedModel: 'm1', scenario: 'base', isResume: false }),
        JSON.stringify({ schemaVersion: 2, event: 'started', parentSessionId: 'parent-a', callId: 'call-dup', agent: 'backend', resolvedModel: 'm1', scenario: 'base', isResume: false }),
        JSON.stringify({ schemaVersion: 2, event: 'finished', parentSessionId: 'parent-a', callId: 'call-dup', agent: 'backend', resolvedModel: 'm1', scenario: 'base', state: 'completed', durationMs: 100, usageAvailable: true, cost: 0, totalTokens: 30, inputTokens: 10, outputTokens: 20, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }),
        JSON.stringify({ schemaVersion: 2, event: 'finished', parentSessionId: 'parent-a', callId: 'call-dup', agent: 'backend', resolvedModel: 'm1', scenario: 'base', state: 'completed', durationMs: 100, usageAvailable: true, cost: 0, totalTokens: 30, inputTokens: 10, outputTokens: 20, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }),
        JSON.stringify({ schemaVersion: 2, event: 'started', parentSessionId: 'parent-b', callId: 'same-call-different-parent', agent: 'junior', resolvedModel: 'm2', scenario: 'custom', isResume: false }),
        JSON.stringify({ schemaVersion: 2, event: 'started', parentSessionId: 'parent-c', callId: 'same-call-different-parent', agent: 'junior', resolvedModel: 'm2', scenario: 'custom', isResume: false }),
        JSON.stringify({ schemaVersion: 2, event: 'started', parentSessionId: 'parent-d', callId: '1700000000000-1', agent: 'junior', resolvedModel: 'm2', scenario: 'custom', isResume: false }),
        JSON.stringify({ schemaVersion: 2, event: 'started', parentSessionId: 'parent-d', callId: '1700000000000-1', agent: 'junior', resolvedModel: 'm2', scenario: 'custom', isResume: false }),
      ].join('\n'))

      const result = await execFileAsync('node', ['scripts/opencode-agent-stats.mjs', journalPath])
      expect(result.stdout).toContain('backend\tm1\tbase\t1\t1\t1\t0\t0\t0\t100.0%\t0.0%\t100\t100.0%\t0\t0\t30\t30\t10\t20\t0\t0\t0')
      expect(result.stdout).toContain('junior\tm2\tcustom\t4\t0\t0\t0\t4\t0\t0.0%\t0.0%\t0\t0.0%\t0\t0\t0\t0\t0\t0\t0\t0\t0')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

type LegacyServerPlugin = (input: unknown, options?: unknown) => Promise<unknown> | unknown

function collectLegacyServerPlugins(mod: Record<string, unknown>): LegacyServerPlugin[] {
  const seen = new Set<unknown>()
  const result: LegacyServerPlugin[] = []

  for (const entry of Object.values(mod)) {
    if (seen.has(entry)) continue
    seen.add(entry)
    if (typeof entry === 'function') result.push(entry as LegacyServerPlugin)
  }

  return result
}

function isHookObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && 'tool.execute.before' in value
}

function assistantMessage(sessionID: string, id: string, tokens: { input: number; output: number; reasoning: number; cache: { read: number; write: number } }, cost: number) {
  return {
    role: 'assistant' as const,
    sessionID,
    id,
    time: { created: 1, completed: 2 },
    parentID: 'parent-message',
    cost,
    tokens,
    modelID: 'openai/gpt-5.5',
    providerID: 'openai',
    mode: 'subagent',
    path: { cwd: '/', root: '/' },
  }
}

function childSession(id: string) {
  return { id, parentID: 'parent', projectID: 'p', directory: '/', title: 'child', version: '1', time: { created: 1, updated: 1 } }
}

function fullGpt56Config() {
  return {
    model: 'openai/gpt-5.6-sol',
    agent: {
      lead: { model: 'openai/gpt-5.6-sol', variant: 'high' },
      architecture: { model: 'openai/gpt-5.5', variant: 'high' },
      backend: { model: 'openai/gpt-5.5', variant: 'high' },
      logic: { model: 'openai/gpt-5.5', variant: 'high' },
      frontend: { model: 'openai/gpt-5.5', variant: 'medium' },
      design: { model: 'openai/gpt-5.5', variant: 'medium' },
      scenario: { model: 'openai/gpt-5.5', variant: 'medium' },
      specialist: { model: 'openai/gpt-5.5', variant: 'medium' },
      junior: { model: 'openai/gpt-5.4-mini', variant: 'low' },
      explore: { model: 'openai/gpt-5.4-mini', variant: 'low' },
      general: { model: 'openai/gpt-5.5', variant: 'medium' },
      'creative-director': { model: 'openai/gpt-5.6-sol', variant: 'high' },
      'motion-game-consultant': { model: 'openai/gpt-5.6-sol', variant: 'high' },
      'interactive-frontend': { model: 'openai/gpt-5.6-sol', variant: 'high' },
      'visual-reviewer': { model: 'openai/gpt-5.6-sol', variant: 'high' },
      reviewer: { model: 'openai/gpt-5.5', variant: 'high' },
      'critical-reviewer': { model: 'openai/gpt-5.6-sol', variant: 'xhigh' },
    },
  }
}

function fullBalancedConfig() {
  return {
    ...fullGpt56Config(),
    agent: {
      ...fullGpt56Config().agent,
      explore: { model: 'opencode/north-mini-code-free' },
      'research-free': { model: 'opencode/nemotron-3-ultra-free' },
      'agent-auditor': { model: 'opencode/nemotron-3-ultra-free' },
      local: { model: 'ollama/batiai/qwen3.6-27b:q4-32k' },
    },
  }
}

async function readJournal(path: string): Promise<AgentRunRecord[]> {
  return (await readFile(path, 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as AgentRunRecord)
}
