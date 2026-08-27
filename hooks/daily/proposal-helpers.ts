import type { DailyScheduleProposalMetadata } from '@/lib/daily-schedule-proposal'
import type { DailySchedule, DailyScheduleLoadSummary } from '@/lib/daily-schedule'
import { computeClientScheduleLoadSummary } from './schedule-helpers'
import { isPendingChatMessageId } from './chat-helpers'
import type { ChatMessage } from './types'

export type ProposalApplyOptions = { confirmed: true; replaceExisting: boolean }

export type ProposalApplyResponse = {
  schedule: DailySchedule | null
  updatedAt: string | null
  status?: string
  loadSummary?: DailyScheduleLoadSummary | null
  planTasks?: string[]
}

export type ApplyDailyScheduleProposalParams = {
  ensureEntrySaved: () => Promise<boolean>
  flushScheduleChanges: () => Promise<boolean>
  applyProposalRequest: () => Promise<ProposalApplyResponse>
  applySavedSchedule: (schedule: DailySchedule, expectedDate?: string) => boolean
  applyPlanTasks?: (planTasks: string[]) => void
  markChatProposalApplied: (appliedAt: string) => void
  expectedDate?: string
  now?: () => Date
}

export function proposalHasExistingSchedule(metadata: Pick<DailyScheduleProposalMetadata, 'currentScheduleExists' | 'currentScheduleHash'>): boolean {
  return metadata.currentScheduleExists
}

export function buildProposalApplyOptions(metadata: Pick<DailyScheduleProposalMetadata, 'currentScheduleExists' | 'currentScheduleHash'>): ProposalApplyOptions {
  return {
    confirmed: true,
    replaceExisting: proposalHasExistingSchedule(metadata),
  }
}

export function parsePersistedNumericMessageId(messageId: string | undefined): number | null {
  if (!messageId || !/^[1-9]\d*$/.test(messageId)) return null
  const numeric = Number(messageId)
  if (!Number.isSafeInteger(numeric) || numeric <= 0) return null
  return numeric
}

export function buildApplyProposalRequestBody(input: {
  date: string
  messageId: string
  options: ProposalApplyOptions
  expectedCurrentScheduleHash: string | null
}): { date: string; messageId: number; confirmed: true; replaceExisting: boolean; expectedCurrentScheduleHash: string | null } | null {
  const numericMessageId = parsePersistedNumericMessageId(input.messageId)
  if (numericMessageId === null) return null
  return {
    date: input.date,
    messageId: numericMessageId,
    confirmed: input.options.confirmed,
    replaceExisting: input.options.replaceExisting,
    expectedCurrentScheduleHash: input.expectedCurrentScheduleHash,
  }
}

export type UnappliedScheduleProposalSelection = {
  messageId: string
}

/**
 * Ищет последнее предложение расписания в чате, которое ещё не применено (нет
 * metadata.appliedAt) и видимо пользователю (сообщение сохранено на сервере — не
 * pending, и не скрыто локальной кнопкой «Отменить»). В отличие от
 * selectLatestVisiblePendingScheduleProposal (schedule-confirmation-helpers.ts),
 * которая проверяет только последнее сообщение чата для строгого текстового
 * подтверждения, здесь сканируется вся история — карточка могла остаться
 * неприменённой, даже если пользователь продолжил диалог дальше.
 */
export function findLatestUnappliedScheduleProposal(
  messages: Pick<ChatMessage, 'id' | 'role' | 'metadata'>[],
  dismissedProposalIds: ReadonlySet<string>,
): UnappliedScheduleProposalSelection | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'assistant') continue
    const metadata = message.metadata
    if (!metadata || metadata.type !== 'daily_schedule_proposal' || metadata.appliedAt) continue
    if (!message.id || isPendingChatMessageId(message.id) || dismissedProposalIds.has(message.id)) continue
    return { messageId: message.id }
  }
  return null
}

export function getProposalNewTasks(metadata: DailyScheduleProposalMetadata): string[] {
  if (metadata.schemaVersion !== 3) return []
  return [...metadata.proposal.newTasks]
}

export function proposalMetadataToSchedule(metadata: DailyScheduleProposalMetadata, options: { currentPlanTaskCount?: number } = {}): DailySchedule {
  const proposal = metadata.proposal
  if (proposal.version === 1) {
    return {
      version: 2,
      timezone: proposal.timezone,
      dayStartMinutes: proposal.dayStartMinutes,
      dayEndMinutes: proposal.dayEndMinutes,
      blocks: proposal.blocks.map((block, index) => {
        const id = `draft-${index}-${block.kind}-${block.startMinutes}-${block.durationMinutes}`
        if (block.kind === 'task') return { id, kind: 'task', taskIndex: block.taskIndex!, taskText: block.taskText!, startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
        return { id, kind: block.kind, title: block.title!, startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
      }),
    }
  }
  const currentPlanTaskCount = options.currentPlanTaskCount ?? 0
  return {
    version: 3,
    timezone: proposal.timezone,
    dayStartMinutes: proposal.dayStartMinutes,
    dayEndMinutes: proposal.dayEndMinutes,
    planningBasis: proposal.planningBasis,
    planningStartMinutes: proposal.planningStartMinutes,
    workEndMinutes: proposal.workEndMinutes,
    activityEndMinutes: proposal.activityEndMinutes,
    blocks: proposal.blocks.map((block, index) => {
      const id = `draft-${index}-${block.kind}-${block.startMinutes}-${block.durationMinutes}`
      if (block.kind === 'task') {
        const taskIndex = proposal.version === 3 && 'taskSource' in block && block.taskSource === 'new'
          ? currentPlanTaskCount + block.taskIndex
          : block.taskIndex
        const taskText = proposal.version === 3 && 'taskSource' in block && block.taskSource === 'new'
          ? proposal.newTasks[block.taskIndex - 1] ?? block.taskText
          : block.taskText
        return { id, kind: 'task', taskIndex, taskText, category: block.category, isFixed: block.isFixed, startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
      }
      return { id, kind: block.kind, title: block.title, category: block.category, isFixed: block.isFixed, startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
    }),
  }
}

export function getProposalLoadSummary(metadata: DailyScheduleProposalMetadata): DailyScheduleLoadSummary {
  if (metadata.schemaVersion === 2 || metadata.schemaVersion === 3) return metadata.loadSummary
  return computeClientScheduleLoadSummary(proposalMetadataToSchedule(metadata))
}

export async function applyDailyScheduleProposal({
  ensureEntrySaved,
  flushScheduleChanges,
  applyProposalRequest,
  applySavedSchedule,
  applyPlanTasks,
  markChatProposalApplied,
  expectedDate,
  now = () => new Date(),
}: ApplyDailyScheduleProposalParams): Promise<void> {
  const saved = await ensureEntrySaved()
  if (!saved) {
    throw new Error('Сначала сохраните текущий план, чтобы расписание совпало со списком задач')
  }

  const scheduleSaved = await flushScheduleChanges()
  if (!scheduleSaved) {
    throw new Error('Не удалось сохранить изменения расписания. Расписание не применено.')
  }

  const response = await applyProposalRequest()
  if (response.status === 'already_applied') return
  if (!response.schedule) throw new Error('Сервер не вернул расписание')
  if (response.planTasks) applyPlanTasks?.(response.planTasks)
  const applied = applySavedSchedule(response.schedule, expectedDate)
  if (!applied) throw new Error('Расписание пришло для другой даты и не было применено')
  markChatProposalApplied(now().toISOString())
}
