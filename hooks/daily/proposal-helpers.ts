import type { DailyScheduleProposalMetadata } from '@/lib/daily-schedule-proposal'
import type { DailySchedule, DailyScheduleLoadSummary } from '@/lib/daily-schedule'
import { computeClientScheduleLoadSummary } from './schedule-helpers'

export type ProposalApplyOptions = { confirmed: true; replaceExisting: boolean }

export type ProposalApplyResponse = {
  schedule: DailySchedule | null
  updatedAt: string | null
  status?: string
  loadSummary?: DailyScheduleLoadSummary | null
}

export type ApplyDailyScheduleProposalParams = {
  ensureEntrySaved: () => Promise<boolean>
  flushScheduleChanges: () => Promise<boolean>
  applyProposalRequest: () => Promise<ProposalApplyResponse>
  applySavedSchedule: (schedule: DailySchedule, expectedDate?: string) => boolean
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

export function proposalMetadataToSchedule(metadata: DailyScheduleProposalMetadata): DailySchedule {
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
      if (block.kind === 'task') return { id, kind: 'task', taskIndex: block.taskIndex, taskText: block.taskText, category: block.category, isFixed: block.isFixed, startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
      return { id, kind: block.kind, title: block.title, category: block.category, isFixed: block.isFixed, startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
    }),
  }
}

export function getProposalLoadSummary(metadata: DailyScheduleProposalMetadata): DailyScheduleLoadSummary {
  if (metadata.schemaVersion === 2) return metadata.loadSummary
  return computeClientScheduleLoadSummary(proposalMetadataToSchedule(metadata))
}

export async function applyDailyScheduleProposal({
  ensureEntrySaved,
  flushScheduleChanges,
  applyProposalRequest,
  applySavedSchedule,
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
  if (!response.schedule) throw new Error('Сервер не вернул расписание')
  const applied = applySavedSchedule(response.schedule, expectedDate)
  if (!applied) throw new Error('Расписание пришло для другой даты и не было применено')
  markChatProposalApplied(now().toISOString())
}
