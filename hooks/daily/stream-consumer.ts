import type { DailySchedule, DailyScheduleBlock } from '@/lib/daily-schedule'
import { isTimeStep } from '@/lib/daily-schedule-time'

const scheduleCategories = ['main', 'operational', 'travel', 'personal', 'meal', 'rest', 'buffer'] as const

function getBlockEnd(block: { startMinutes: number; durationMinutes: number }): number {
  return block.startMinutes + block.durationMinutes
}

function blocksOverlap(a: { startMinutes: number; durationMinutes: number }, b: { startMinutes: number; durationMinutes: number }): boolean {
  return a.startMinutes < getBlockEnd(b) && b.startMinutes < getBlockEnd(a)
}

export type TextStreamPublisher = (text: string) => void | Promise<void>
export type FrameScheduler = () => Promise<void>

export type DailyChatSseEvent =
  | { type: 'text'; text: string }
  | { type: 'proposal'; metadata: unknown }
  | { type: 'done'; assistantMessageId: string }
  | { type: 'error'; error: string }

export interface DailyChatStreamCallbacks {
  onText?: (text: string, fullText: string) => void | Promise<void>
  onProposal?: (metadata: unknown) => void | Promise<void>
  onDone?: (assistantMessageId: string) => void | Promise<void>
  onError?: (error: string) => void | Promise<void>
  onEvent?: (event: DailyChatSseEvent) => void | Promise<void>
}

export class DailyChatSseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DailyChatSseError'
  }
}

const fallbackFrameDelay = 0

export function waitForNextBrowserFrame(): Promise<void> {
  const isHiddenTab = typeof document !== 'undefined' && document.visibilityState === 'hidden'

  if (!isHiddenTab && typeof requestAnimationFrame === 'function') {
    return new Promise(resolve => {
      requestAnimationFrame(() => resolve())
    })
  }

  return new Promise(resolve => {
    setTimeout(resolve, fallbackFrameDelay)
  })
}

export async function consumeTextStream(
  stream: ReadableStream<Uint8Array> | null | undefined,
  publishText: TextStreamPublisher,
  scheduleFrame: FrameScheduler = waitForNextBrowserFrame,
): Promise<string> {
  if (!stream) return ''

  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let publishedText = ''

  const publishIfChanged = async () => {
    if (text === publishedText) return

    await publishText(text)
    publishedText = text
    await scheduleFrame()
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunkText = decoder.decode(value, { stream: true })
      if (!chunkText) continue


      text += chunkText
      await publishIfChanged()
    }

    const finalText = decoder.decode()
    if (finalText) {
      text += finalText
      await publishIfChanged()
    }

    return text
  } finally {
    reader.releaseLock()
  }
}

function parseSseData(data: string): unknown {
  const trimmed = data.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isScheduleBlock(value: unknown, version: 1 | 2 | 3): value is DailyScheduleBlock {
  if (!isObject(value)) return false
  if (typeof value.id !== 'string' || !Number.isInteger(value.startMinutes) || !Number.isInteger(value.durationMinutes)) return false
  const startMinutes = value.startMinutes as number
  const durationMinutes = value.durationMinutes as number
  if (startMinutes < 0 || getBlockEnd({ startMinutes, durationMinutes }) > 1440 || durationMinutes <= 0) return false
  if (!isTimeStep(startMinutes) || !isTimeStep(durationMinutes)) return false
  if (version === 1) {
    return Number.isInteger(value.taskIndex) && typeof value.taskText === 'string' && value.taskText.trim().length > 0
  }
  if (version === 3) {
    if (!scheduleCategories.includes(value.category as (typeof scheduleCategories)[number]) || typeof value.isFixed !== 'boolean') return false
  }
  if (value.kind === 'task') {
    return Number.isInteger(value.taskIndex) && typeof value.taskText === 'string' && value.taskText.trim().length > 0
  }
  return (value.kind === 'meal' || value.kind === 'rest' || value.kind === 'buffer')
    && typeof value.title === 'string'
    && value.title.trim().length > 0
}

export function isDailySchedulePayload(value: unknown): value is DailySchedule {
  if (!isObject(value)) return false
  if (value.version !== 1 && value.version !== 2 && value.version !== 3) return false
  if (typeof value.timezone !== 'string' || !Number.isInteger(value.dayStartMinutes) || !Number.isInteger(value.dayEndMinutes)) return false
  const version = value.version
  const dayStartMinutes = value.dayStartMinutes as number
  const dayEndMinutes = value.dayEndMinutes as number
  if (dayStartMinutes < 0 || dayEndMinutes <= dayStartMinutes || dayEndMinutes > 1440) return false
  if (!isTimeStep(dayStartMinutes) || !isTimeStep(dayEndMinutes)) return false
  if (version === 3) {
    if (value.planningBasis !== 'current_time' && value.planningBasis !== 'day_start' && value.planningBasis !== 'custom_time') return false
    if (!Number.isInteger(value.planningStartMinutes) || !Number.isInteger(value.workEndMinutes) || !Number.isInteger(value.activityEndMinutes)) return false
    const planningStart = value.planningStartMinutes as number
    const workEnd = value.workEndMinutes as number
    const activityEnd = value.activityEndMinutes as number
    if (!isTimeStep(planningStart) || !isTimeStep(workEnd) || !isTimeStep(activityEnd)) return false
    if (!(planningStart < workEnd && workEnd <= activityEnd)) return false
    if (dayStartMinutes !== planningStart || dayEndMinutes !== activityEnd) return false
  }
  if (!Array.isArray(value.blocks)) return false
  if (!value.blocks.every(block => isScheduleBlock(block, version))) return false
  const sorted = [...value.blocks].sort((a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id))
  for (let index = 1; index < sorted.length; index += 1) {
    if (blocksOverlap(sorted[index - 1], sorted[index])) return false
  }
  return true
}

function eventFromFrame(eventName: string, data: string): DailyChatSseEvent | null {
  const payload = parseSseData(data)
  if (eventName === 'text') {
    if (typeof payload === 'object' && payload !== null && 'text' in payload) {
      return { type: 'text', text: String((payload as { text: unknown }).text ?? '') }
    }
    return { type: 'text', text: typeof payload === 'string' ? payload : '' }
  }
  if (eventName === 'proposal') {
    const metadata = typeof payload === 'object' && payload !== null && 'metadata' in payload
      ? (payload as { metadata: unknown }).metadata
      : payload
    return { type: 'proposal', metadata }
  }
  if (eventName === 'schedule_applied') {
    return null
  }
  if (eventName === 'done') {
    const assistantMessageId = typeof payload === 'object' && payload !== null && 'assistantMessageId' in payload
      ? String((payload as { assistantMessageId: unknown }).assistantMessageId ?? '')
      : typeof payload === 'string' ? payload : ''
    return assistantMessageId ? { type: 'done', assistantMessageId } : null
  }
  if (eventName === 'error') {
    const error = typeof payload === 'object' && payload !== null && 'error' in payload
      ? String((payload as { error: unknown }).error ?? '')
      : typeof payload === 'string' ? payload : 'Ошибка потока'
    return { type: 'error', error }
  }
  return null
}

export async function consumeDailyChatSseStream(
  stream: ReadableStream<Uint8Array> | null | undefined,
  callbacks: DailyChatStreamCallbacks,
  scheduleFrame: FrameScheduler = waitForNextBrowserFrame,
): Promise<{ text: string; assistantMessageId: string | null; metadata: unknown | null }> {
  if (!stream) return { text: '', assistantMessageId: null, metadata: null }

  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let assistantMessageId: string | null = null
  let metadata: unknown | null = null

  const dispatch = async (event: DailyChatSseEvent) => {
    await callbacks.onEvent?.(event)
    if (event.type === 'text') {
      text += event.text
      await callbacks.onText?.(event.text, text)
      await scheduleFrame()
    } else if (event.type === 'proposal') {
      metadata = event.metadata
      await callbacks.onProposal?.(event.metadata)
    } else if (event.type === 'done') {
      assistantMessageId = event.assistantMessageId
      await callbacks.onDone?.(event.assistantMessageId)
    } else if (event.type === 'error') {
      await callbacks.onError?.(event.error)
      throw new DailyChatSseError(event.error)
    }
  }

  const processFrame = async (frame: string) => {
    const lines = frame.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
    let eventName = 'message'
    const dataLines: string[] = []
    for (const line of lines) {
      if (!line || line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon >= 0 ? line.slice(0, colon) : line
      const rawValue = colon >= 0 ? line.slice(colon + 1) : ''
      const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue
      if (field === 'event') eventName = value
      else if (field === 'data') dataLines.push(value)
    }
    const event = eventFromFrame(eventName, dataLines.join('\n'))
    if (event) await dispatch(event)
  }

  const drainFrames = async () => {
    while (true) {
      const normalized = buffer.replace(/\r\n/g, '\n')
      const boundary = normalized.indexOf('\n\n')
      if (boundary < 0) break
      const frame = normalized.slice(0, boundary)
      buffer = normalized.slice(boundary + 2)
      await processFrame(frame)
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      await drainFrames()
    }
    buffer += decoder.decode()
    if (buffer.trim()) {
      await processFrame(buffer)
      buffer = ''
    }
    return { text, assistantMessageId, metadata }
  } finally {
    reader.releaseLock()
  }
}
