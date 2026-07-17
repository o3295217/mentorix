import { mkdir, appendFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export const JOURNAL_SCHEMA_VERSION = 2
export const DEFAULT_JOURNAL_RELATIVE_PATH = '.opencode/metrics/agent-runs.jsonl'

const MAX_DESCRIPTION_LENGTH = 180
const MAX_TRACKED_STARTED_CALLS = 256
const MAX_TRACKED_USAGE_SESSIONS = 256
const MAX_UNMATCHED_USAGE_SESSIONS = 64
const MAX_PENDING_CHILD_SESSIONS = 256

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
  usageAvailable: boolean
  usageMessageCount: number
  inputTokens: number | null
  outputTokens: number | null
  reasoningTokens: number | null
  cacheReadTokens: number | null
  cacheWriteTokens: number | null
  totalTokens: number | null
  cost: number | null
  usageModelId: string | null
  usageProviderId: string | null
  usageMode: string | null
  usageVariant: string | null
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

type AssistantMessageUsage = {
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  cost: number | null
  modelId: string | null
  providerId: string | null
  mode: string | null
  variant: string | null
}

type SessionUsage = {
  messages: Map<string, AssistantMessageUsage>
  lastSeen: number
  isChild: boolean
}

type UsageSummary = Pick<AgentRunRecord,
  | 'usageAvailable'
  | 'usageMessageCount'
  | 'inputTokens'
  | 'outputTokens'
  | 'reasoningTokens'
  | 'cacheReadTokens'
  | 'cacheWriteTokens'
  | 'totalTokens'
  | 'cost'
  | 'usageModelId'
  | 'usageProviderId'
  | 'usageMode'
  | 'usageVariant'
>

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
  const sessionUsage = new Map<string, SessionUsage>()
  const pendingChildSessions = new Map<string, number>()
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
          ...emptyUsageSummary(),
        }
        calls.set(callId, { startedAt: timestamp.getTime(), record })
        evictStartedCalls(calls)
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
        const usage = summarizeSessionUsage(parsed.returnedTaskId ? sessionUsage.get(parsed.returnedTaskId)?.messages : undefined)
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
          ...usage,
        }
        if (callId) calls.delete(callId)
        if (parsed.returnedTaskId) {
          sessionUsage.delete(parsed.returnedTaskId)
          pendingChildSessions.delete(parsed.returnedTaskId)
        }
        await append(record)
      } catch {
        // Logger errors must never break opencode tool execution.
      }
    },

    async event(input: unknown): Promise<void> {
      try {
        const event = getValue(input, ['event']) ?? input
        const eventName = getString(event, ['type']) ?? getString(event, ['name']) ?? getString(event, ['event'])
        if (eventName === 'session.created') {
          const info = getSessionInfo(event)
          const sessionId = getSessionId(info)
          const parentId = getString(info, ['parentID']) ?? getString(info, ['parentId'])
          if (sessionId && parentId) {
            const existing = sessionUsage.get(sessionId)
            if (existing) {
              existing.isChild = true
              existing.lastSeen = Date.now()
            } else {
              pendingChildSessions.set(sessionId, Date.now())
            }
          }
          evictTrackedSessions(sessionUsage, pendingChildSessions)
          return
        }
        if (eventName === 'session.deleted') {
          const info = getSessionInfo(event)
          const sessionId = getSessionId(info)
          if (sessionId) {
            sessionUsage.delete(sessionId)
            pendingChildSessions.delete(sessionId)
          }
          return
        }
        if (eventName !== 'message.updated') return

        const message = getMessageLike(event)
        const sessionId = getSessionId(message) ?? getSessionId(event)
        const messageId = getMessageId(message) ?? getMessageId(event)
        if (!sessionId || !messageId || !isAssistantMessage(message)) return

        const usage = parseAssistantMessageUsage(message)
        if (!usage) return

        const entry = sessionUsage.get(sessionId) ?? { messages: new Map<string, AssistantMessageUsage>(), lastSeen: 0, isChild: pendingChildSessions.has(sessionId) }
        entry.messages.set(messageId, usage)
        entry.lastSeen = Date.now()
        entry.isChild = entry.isChild || pendingChildSessions.has(sessionId)
        sessionUsage.set(sessionId, entry)
        pendingChildSessions.delete(sessionId)
        evictTrackedSessions(sessionUsage, pendingChildSessions)
      } catch {
        // Logger errors must never break opencode event handling.
      }
    },

    flush(): Promise<void> {
      return queue
    },

    getMemoryStats(): { startedCallCount: number; usageSessionCount: number; unmatchedUsageSessionCount: number; childUsageSessionCount: number; pendingChildSessionCount: number } {
      let childUsageSessionCount = 0
      for (const value of sessionUsage.values()) {
        if (value.isChild) childUsageSessionCount += 1
      }
      return {
        startedCallCount: calls.size,
        usageSessionCount: sessionUsage.size,
        unmatchedUsageSessionCount: sessionUsage.size - childUsageSessionCount,
        childUsageSessionCount,
        pendingChildSessionCount: pendingChildSessions.size,
      }
    },
  }
}

function emptyUsageSummary(): UsageSummary {
  return {
    usageAvailable: false,
    usageMessageCount: 0,
    inputTokens: null,
    outputTokens: null,
    reasoningTokens: null,
    cacheReadTokens: null,
    cacheWriteTokens: null,
    totalTokens: null,
    cost: null,
    usageModelId: null,
    usageProviderId: null,
    usageMode: null,
    usageVariant: null,
  }
}

function summarizeSessionUsage(messages: Map<string, AssistantMessageUsage> | undefined): UsageSummary {
  if (!messages || messages.size === 0) return emptyUsageSummary()

  const values = [...messages.values()]
  const inputTokens = sum(values, 'inputTokens')
  const outputTokens = sum(values, 'outputTokens')
  const reasoningTokens = sum(values, 'reasoningTokens')
  const cacheReadTokens = sum(values, 'cacheReadTokens')
  const cacheWriteTokens = sum(values, 'cacheWriteTokens')
  const costs = values.map((value) => value.cost).filter((value): value is number => typeof value === 'number')

  return {
    usageAvailable: true,
    usageMessageCount: values.length,
    inputTokens,
    outputTokens,
    reasoningTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalTokens: inputTokens + outputTokens,
    cost: costs.length > 0 ? roundCost(costs.reduce((total, value) => total + value, 0)) : null,
    usageModelId: uniqueStringOrNull(values.map((value) => value.modelId)),
    usageProviderId: uniqueStringOrNull(values.map((value) => value.providerId)),
    usageMode: uniqueStringOrNull(values.map((value) => value.mode)),
    usageVariant: uniqueStringOrNull(values.map((value) => value.variant)),
  }
}

function parseAssistantMessageUsage(message: unknown): AssistantMessageUsage | null {
  const info = getValue(message, ['info'])
  const tokens = getValue(message, ['tokens']) ?? getValue(message, ['usage', 'tokens']) ?? getValue(message, ['usage']) ?? getValue(info, ['tokens']) ?? getValue(info, ['usage', 'tokens']) ?? getValue(info, ['usage'])
  const inputTokens = getNumber(tokens, ['input'])
  const outputTokens = getNumber(tokens, ['output'])
  const reasoningTokens = getNumber(tokens, ['reasoning'])
  const cacheReadTokens = getNumber(tokens, ['cache', 'read'])
  const cacheWriteTokens = getNumber(tokens, ['cache', 'write'])
  const cost = getNumber(message, ['cost']) ?? getNumber(info, ['cost'])
  const hasUsage = [inputTokens, outputTokens, reasoningTokens, cacheReadTokens, cacheWriteTokens, cost].some((value) => typeof value === 'number')
  if (!hasUsage) return null

  return {
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
    reasoningTokens: reasoningTokens ?? 0,
    cacheReadTokens: cacheReadTokens ?? 0,
    cacheWriteTokens: cacheWriteTokens ?? 0,
    cost,
    modelId: getString(message, ['modelID']) ?? getString(message, ['modelId']) ?? getString(message, ['model', 'id']) ?? getString(info, ['modelID']) ?? getString(info, ['modelId']) ?? getString(info, ['model', 'id']),
    providerId: getString(message, ['providerID']) ?? getString(message, ['providerId']) ?? getString(message, ['provider', 'id']) ?? getString(info, ['providerID']) ?? getString(info, ['providerId']) ?? getString(info, ['provider', 'id']),
    mode: getString(message, ['mode']) ?? getString(info, ['mode']),
    variant: getString(message, ['variant']) ?? getString(info, ['variant']),
  }
}

function getMessageLike(event: unknown): unknown {
  return getValue(event, ['message']) ?? getValue(event, ['info']) ?? getValue(event, ['properties', 'message']) ?? getValue(event, ['properties', 'info']) ?? getValue(event, ['data', 'message']) ?? getValue(event, ['data', 'info']) ?? getValue(event, ['payload', 'message']) ?? getValue(event, ['payload', 'info']) ?? event
}

function getSessionInfo(event: unknown): unknown {
  return getValue(event, ['properties', 'info']) ?? getValue(event, ['info']) ?? getValue(event, ['data', 'info']) ?? getValue(event, ['payload', 'info']) ?? event
}

function evictStartedCalls(calls: Map<string, StartedCall>): void {
  evictOldest(calls, () => true, MAX_TRACKED_STARTED_CALLS)
}

function evictTrackedSessions(sessionUsage: Map<string, SessionUsage>, pendingChildSessions: Map<string, number>): void {
  evictOldest(sessionUsage, (entry) => !entry.isChild, MAX_UNMATCHED_USAGE_SESSIONS)
  evictOldest(sessionUsage, () => true, MAX_TRACKED_USAGE_SESSIONS)
  evictOldest(pendingChildSessions, () => true, MAX_PENDING_CHILD_SESSIONS)
}

function evictOldest<T>(items: Map<string, T>, predicate: (entry: T) => boolean, limit: number): void {
  let candidates = [...items.entries()].filter(([, entry]) => predicate(entry))
  while (candidates.length > limit) {
    candidates.sort((left, right) => getLastSeen(left[1]) - getLastSeen(right[1]))
    const [sessionId] = candidates.shift() ?? []
    if (!sessionId) return
    items.delete(sessionId)
  }
}

function getLastSeen(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null && 'lastSeen' in value) {
    const lastSeen = (value as { lastSeen?: unknown }).lastSeen
    if (typeof lastSeen === 'number') return lastSeen
  }
  if (typeof value === 'object' && value !== null && 'startedAt' in value) {
    const startedAt = (value as { startedAt?: unknown }).startedAt
    if (typeof startedAt === 'number') return startedAt
  }
  return 0
}

function isAssistantMessage(message: unknown): boolean {
  const role = getString(message, ['role']) ?? getString(message, ['type']) ?? getString(message, ['info', 'role'])
  return role === null || role === 'assistant'
}

function getSessionId(value: unknown): string | null {
  return getString(value, ['sessionID']) ?? getString(value, ['sessionId']) ?? getString(value, ['session', 'id']) ?? getString(value, ['id']) ?? getString(value, ['info', 'sessionID']) ?? getString(value, ['info', 'sessionId']) ?? getString(value, ['info', 'id'])
}

function getMessageId(value: unknown): string | null {
  return getString(value, ['id']) ?? getString(value, ['messageID']) ?? getString(value, ['messageId'])
}

function sum(values: AssistantMessageUsage[], key: keyof Pick<AssistantMessageUsage, 'inputTokens' | 'outputTokens' | 'reasoningTokens' | 'cacheReadTokens' | 'cacheWriteTokens'>): number {
  return values.reduce((total, value) => total + value[key], 0)
}

function uniqueStringOrNull(values: Array<string | null>): string | null {
  const unique = [...new Set(values.filter((value): value is string => Boolean(value)))]
  return unique.length === 1 ? unique[0] : null
}

function roundCost(value: number): number {
  return Number(value.toFixed(12))
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

function getNumber(value: unknown, path: string[]): number | null {
  const result = getValue(value, path)
  return typeof result === 'number' && Number.isFinite(result) ? result : null
}

function getValue(value: unknown, path: string[]): unknown {
  let current = value
  for (const key of path) {
    if (typeof current !== 'object' || current === null || !(key in current)) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}
