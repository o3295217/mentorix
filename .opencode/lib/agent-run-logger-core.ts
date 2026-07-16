import { mkdir, appendFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export const JOURNAL_SCHEMA_VERSION = 1
export const DEFAULT_JOURNAL_RELATIVE_PATH = '.opencode/metrics/agent-runs.jsonl'

const MAX_DESCRIPTION_LENGTH = 180

export type AgentRunEventName = 'started' | 'finished'
export type TaskState = 'completed' | 'error' | 'unknown'
export type ScenarioName = 'base' | 'agent2.0_gpt56' | 'custom'

export type AgentRunRecord = {
  schemaVersion: number
  event: AgentRunEventName
  timestamp: string
  parentSessionId: string | null
  callId: string
  description: string
  agent: string
  resolvedModel: string | null
  scenario: ScenarioName
  isResume: boolean
  resumedTaskId: string | null
  returnedTaskId: string | null
  state: TaskState | null
  durationMs: number | null
}

type ConfigLike = {
  model?: unknown
  default_agent?: unknown
  agent?: Record<string, { model?: unknown } | undefined>
}

type StartedCall = {
  startedAt: number
  record: AgentRunRecord
}

export type LoggerOptions = {
  journalPath: string
  now?: () => Date
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

export function sanitizeDescription(value: unknown): string {
  if (typeof value !== 'string') return ''

  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/\b(?:sk-[a-z0-9_-]{12,}|[a-f0-9]{32,}|[A-Za-z0-9_-]{40,})\b/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DESCRIPTION_LENGTH)
}

export function resolveScenario(config: ConfigLike): ScenarioName {
  const defaultModel = typeof config.model === 'string' ? config.model : null
  const leadModel = getAgentModel(config, 'lead')

  if (defaultModel === 'openai/gpt-5.6-sol' && (leadModel === null || leadModel === 'openai/gpt-5.6-sol')) {
    return 'agent2.0_gpt56'
  }

  if (defaultModel === 'anthropic/claude-fable-5' && leadModel !== 'openai/gpt-5.6-sol') {
    return 'base'
  }

  return 'custom'
}

export function resolveModel(config: ConfigLike, agent: string): string | null {
  return getAgentModel(config, agent) ?? (typeof config.model === 'string' ? config.model : null)
}

export function parseTaskOutput(output: unknown): Pick<AgentRunRecord, 'returnedTaskId' | 'state'> {
  const text = collectStrings(output).join('\n')
  const returnedTaskId = firstMatch(text, /<task\b[^>]*\bid=["']([^"']+)["'][^>]*>/i)
  const rawState = firstMatch(text, /<task\b[^>]*\bstate=["']([^"']+)["'][^>]*>/i)
  const state = normalizeState(rawState ?? text)

  return {
    returnedTaskId,
    state,
  }
}

export function createAgentRunLogger(options: LoggerOptions) {
  const calls = new Map<string, StartedCall>()
  let queue = Promise.resolve()
  let sequence = 0
  const now = options.now ?? (() => new Date())

  function append(record: AgentRunRecord): Promise<void> {
    queue = queue
      .then(async () => {
        await mkdir(dirname(options.journalPath), { recursive: true })
        await appendFile(options.journalPath, `${JSON.stringify(record)}\n`, 'utf8')
      })
      .catch(() => undefined)

    return queue
  }

  return {
    async started(input: unknown, config: ConfigLike): Promise<void> {
      try {
        if (!isTaskTool(input)) return
        const args = getArgs(input)
        const agent = getString(args, ['subagent_type']) ?? getString(args, ['agent']) ?? 'unknown'
        const resumedTaskId = getString(args, ['task_id'])
        const callId = getCallId(input) ?? `${Date.now()}-${++sequence}`
        const timestamp = now()
        const record: AgentRunRecord = {
          schemaVersion: JOURNAL_SCHEMA_VERSION,
          event: 'started',
          timestamp: timestamp.toISOString(),
          parentSessionId: getParentSessionId(input),
          callId,
          description: sanitizeDescription(getValue(args, ['description'])),
          agent,
          resolvedModel: resolveModel(config, agent),
          scenario: resolveScenario(config),
          isResume: Boolean(resumedTaskId),
          resumedTaskId,
          returnedTaskId: null,
          state: null,
          durationMs: null,
        }
        calls.set(callId, { startedAt: timestamp.getTime(), record })
        await append(record)
      } catch {
        // Logger errors must never break opencode tool execution.
      }
    },

    async finished(input: unknown, output: unknown): Promise<void> {
      try {
        if (!isTaskTool(input)) return
        const callId = getCallId(input)
        const started = callId ? calls.get(callId) : undefined
        const parsed = parseTaskOutput(output)
        const finishedAt = now()
        const base = started?.record
        const record: AgentRunRecord = {
          schemaVersion: JOURNAL_SCHEMA_VERSION,
          event: 'finished',
          timestamp: finishedAt.toISOString(),
          parentSessionId: base?.parentSessionId ?? getParentSessionId(input),
          callId: callId ?? `${Date.now()}-${++sequence}`,
          description: base?.description ?? sanitizeDescription(getValue(getArgs(input), ['description'])),
          agent: base?.agent ?? getString(getArgs(input), ['subagent_type']) ?? 'unknown',
          resolvedModel: base?.resolvedModel ?? null,
          scenario: base?.scenario ?? 'custom',
          isResume: base?.isResume ?? Boolean(getString(getArgs(input), ['task_id'])),
          resumedTaskId: base?.resumedTaskId ?? getString(getArgs(input), ['task_id']),
          returnedTaskId: parsed.returnedTaskId,
          state: parsed.state,
          durationMs: started ? Math.max(0, finishedAt.getTime() - started.startedAt) : null,
        }
        if (callId) calls.delete(callId)
        await append(record)
      } catch {
        // Logger errors must never break opencode tool execution.
      }
    },

    flush(): Promise<void> {
      return queue
    },
  }
}

export function getDefaultJournalPath(worktree: string): string {
  return join(worktree, DEFAULT_JOURNAL_RELATIVE_PATH)
}

function getAgentModel(config: ConfigLike, agent: string): string | null {
  const model = config.agent?.[agent]?.model
  return typeof model === 'string' ? model : null
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

function getParentSessionId(input: unknown): string | null {
  return getString(input, ['sessionId']) ?? getString(input, ['sessionID']) ?? getString(input, ['session', 'id'])
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
