import type { DailyScheduleProposalMetadata } from '@/lib/daily-schedule-proposal'
import type { DailySchedule } from '@/lib/daily-schedule'

export type ProposalApplyOptions = { confirmed: true; replaceExisting: boolean }

export type ProposalApplyResponse = {
  schedule: DailySchedule | null
  updatedAt: string | null
  status?: string
}

export type ApplyDailyScheduleProposalParams = {
  ensureEntrySaved: () => Promise<boolean>
  flushScheduleChanges: () => Promise<boolean>
  applyProposalRequest: () => Promise<ProposalApplyResponse>
  applySavedSchedule: (schedule: DailySchedule) => void
  markChatProposalApplied: (appliedAt: string) => void
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

export async function applyDailyScheduleProposal({
  ensureEntrySaved,
  flushScheduleChanges,
  applyProposalRequest,
  applySavedSchedule,
  markChatProposalApplied,
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
  applySavedSchedule(response.schedule)
  markChatProposalApplied(now().toISOString())
}
