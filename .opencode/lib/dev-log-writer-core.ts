import { mkdir, appendFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Hooks } from '@opencode-ai/plugin'

const DEV_LOG_RELATIVE_DIR = 'docs/dev-log'
const MAX_DESCRIPTION_LENGTH = 180
const MAX_TRACKED_STARTED_CALLS = 256

const EXCLUDED_AGENTS = new Set(['agent-auditor', 'explore', 'research-free'])

const TABLE_HEADER =
  '| timestamp | agent | description | state | durationMs | isResume | callId |\n' +
  '| --- | --- | --- | --- | --- | --- | --- |\n'

export type TaskState = 'completed' | 'error' | 'unknown'

export type DevLogRecord = {
  timestamp: string
  agent: string
  description: string
  state: TaskState
  durationMs: number | null
  isResume: boolean
  callId: string
}

type StartedCall = {
  startedAt: number
  agent: string
  isResume: boolean
}

type BeforeInput = { tool: string; sessionID: string; callID: string }
type BeforeOutput = { args: unknown }
type AfterInput = { tool: string; sessionID: string; callID: string; args: unknown }
type AfterOutput = { title: string; output: string; metadata: unknown }

export function resolveWorktree(input: { worktree?: unknown; project?: unknown; directory?: unknown }): string {
  if (typeof input.worktree === 'string' && input.worktree) return input.worktree

  const project = input.project
  if (project && typeof project === 'object') {
    const root = (project as { root?: unknown; path?: unknown; directory?: unknown }).root
    if (typeof root === 'string') return root
    const path = (project as { path?: unknown }).path
    if (typeof path === 'string') return path
    const directory = (project as { directory?: unknown }).directory
    if (typeof directory === 'string') return directory
  }

  return typeof input.directory === 'string' ? input.directory : process.cwd()
}

export function isTaskTool(input: unknown): boolean {
  const candidates = [
    getString(input, ['tool']),
    getString(input, ['toolId']),
    getString(input, ['tool_id']),
    getString(input, ['name']),
    getString(input, ['id']),
    getString(input, ['tool', 'id']),
    getString(input, ['tool', 'name']),
  ].filter((candidate): candidate is string => Boolean(candidate))

  return candidates.some((candidate) => {
    const normalized = candidate.toLowerCase().replace(/[:/]/g, '.')
    const parts = normalized.split('.').filter(Boolean)
    return parts.at(-1) === 'task'
  })
}

export function isExcludedAgent(agent: string | null): boolean {
  return agent !== null && EXCLUDED_AGENTS.has(agent)
}

export function sanitizeDescription(value: unknown): string {
  if (typeof value !== 'string') return ''

  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/\b(?:sk-[a-z0-9_-]{12,}|[a-f0-9]{32,}|[A-Za-z0-9_-]{40,})\b/g, '[redacted]')
    .replace(/\|/g, '/')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DESCRIPTION_LENGTH)
}

export function parseTaskState(output: unknown): TaskState {
  const text = collectStrings(output).join('\n')
  const rawState = firstMatch(text, /<task\b[^>]*\bstate=["']([^"']+)["'][^>]*>/i)
  return normalizeState(rawState ?? text)
}

export function getYearMonthUTC(timestamp: Date): string {
  const year = timestamp.getUTCFullYear()
  const month = String(timestamp.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function getDevLogPath(worktree: string, timestamp: Date): string {
  return join(worktree, DEV_LOG_RELATIVE_DIR, `${getYearMonthUTC(timestamp)}.md`)
}

export function formatDevLogRow(record: DevLogRecord): string {
  const duration = record.durationMs === null ? '' : String(record.durationMs)
  return `| ${record.timestamp} | ${record.agent} | ${record.description} | ${record.state} | ${duration} | ${record.isResume} | ${record.callId} |\n`
}

export type DevLogWriterOptions = {
  getPath: (timestamp: Date) => string
  now?: () => Date
}

export function createDevLogWriter(options: DevLogWriterOptions) {
  const calls = new Map<string, StartedCall>()
  const now = options.now ?? (() => new Date())
  let queue = Promise.resolve()

  function append(path: string, row: string): Promise<void> {
    queue = queue
      .then(async () => {
        const hasFile = await fileExists(path)
        await mkdir(dirname(path), { recursive: true })
        const content = hasFile ? row : `${TABLE_HEADER}${row}`
        await appendFile(path, content, 'utf8')
      })
      .catch(() => undefined)

    return queue
  }

  return {
    async started(input: unknown): Promise<void> {
      try {
        if (!isTaskTool(input)) return
        const args = getArgs(input)
        const agent = getString(args, ['subagent_type']) ?? getString(args, ['agent']) ?? 'unknown'
        const callId = getCallId(input)
        if (!callId || isExcludedAgent(agent)) return

        calls.set(callId, {
          startedAt: now().getTime(),
          agent,
          isResume: Boolean(getString(args, ['task_id'])),
        })
        evictStartedCalls(calls)
      } catch {
        // Logger errors must never break opencode tool execution.
      }
    },

    async finished(input: unknown, output: unknown): Promise<void> {
      try {
        if (!isTaskTool(input)) return
        const args = getArgs(input)
        const callId = getCallId(input)
        const requestedAgent = getString(args, ['subagent_type']) ?? getString(args, ['agent'])
        const started = callId ? calls.get(callId) : undefined
        const agent = started?.agent ?? requestedAgent ?? 'unknown'

        if (callId) calls.delete(callId)
        if (isExcludedAgent(agent)) return

        const finishedAt = now()
        const record: DevLogRecord = {
          timestamp: finishedAt.toISOString(),
          agent,
          description: sanitizeDescription(getValue(args, ['description'])),
          state: parseTaskState(output),
          durationMs: started ? Math.max(0, finishedAt.getTime() - started.startedAt) : null,
          isResume: started?.isResume ?? Boolean(getString(args, ['task_id'])),
          callId: callId ?? 'unknown',
        }

        await append(options.getPath(finishedAt), formatDevLogRow(record))
      } catch {
        // Logger errors must never break opencode tool execution.
      }
    },

    flush(): Promise<void> {
      return queue
    },
  }
}

export async function createDevLogWriterHooks(
  input: { worktree?: unknown; project?: unknown; directory?: unknown },
  writerFactory: (worktree: string) => ReturnType<typeof createDevLogWriter> = (worktree) =>
    createDevLogWriter({ getPath: (timestamp) => getDevLogPath(worktree, timestamp) }),
): Promise<Hooks> {
  const worktree = resolveWorktree(input)
  const writer = writerFactory(worktree)

  return {
    'tool.execute.before': async (hookInput: BeforeInput, hookOutput: BeforeOutput) => {
      await writer.started({ ...hookInput, args: hookOutput.args })
    },
    'tool.execute.after': async (hookInput: AfterInput, hookOutput: AfterOutput) => {
      await writer.finished(hookInput, hookOutput)
    },
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function evictStartedCalls(calls: Map<string, StartedCall>): void {
  while (calls.size > MAX_TRACKED_STARTED_CALLS) {
    const [oldest] = calls.keys()
    if (!oldest) return
    calls.delete(oldest)
  }
}

function normalizeState(value: string): TaskState {
  const normalized = value.toLowerCase()
  if (/\b(completed|complete|success|succeeded|done)\b/.test(normalized)) return 'completed'
  if (/\b(error|errored|failed|failure|cancelled|canceled)\b/.test(normalized)) return 'error'
  return 'unknown'
}

function collectStrings(value: unknown, depth = 0): string[] {
  if (depth > 4 || value == null) return []
  if (typeof value === 'string') return [value]
  if (typeof value !== 'object') return []
  if (Array.isArray(value)) return value.flatMap((item) => collectStrings(item, depth + 1))

  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    if (/prompt|command|env|secret|token/i.test(key)) return []
    return collectStrings(item, depth + 1)
  })
}

function firstMatch(value: string, regexp: RegExp): string | null {
  return regexp.exec(value)?.[1] ?? null
}

function getArgs(input: unknown): unknown {
  return getValue(input, ['args']) ?? getValue(input, ['arguments']) ?? getValue(input, ['call', 'args']) ?? {}
}

function getCallId(input: unknown): string | null {
  return (
    getString(input, ['callId']) ??
    getString(input, ['callID']) ??
    getString(input, ['toolCallId']) ??
    getString(input, ['tool_call_id']) ??
    getString(input, ['id']) ??
    getString(input, ['call', 'id'])
  )
}

function getString(value: unknown, path: string[]): string | null {
  const result = getValue(value, path)
  return typeof result === 'string' && result.trim() ? result.trim() : null
}

function getValue(value: unknown, path: string[]): unknown {
  let current = value
  for (const key of path) {
    if (typeof current !== 'object' || current === null || !(key in current)) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}
