import type { DailyScheduleProposalMetadata } from '@/lib/daily-schedule-proposal'

export type ProposalApplyOptions = { confirmed: true; replaceExisting: boolean }

export function proposalHasExistingSchedule(metadata: Pick<DailyScheduleProposalMetadata, 'currentScheduleExists' | 'currentScheduleHash'>): boolean {
  return metadata.currentScheduleExists
}

export function buildProposalApplyOptions(metadata: Pick<DailyScheduleProposalMetadata, 'currentScheduleExists' | 'currentScheduleHash'>): ProposalApplyOptions {
  return {
    confirmed: true,
    replaceExisting: proposalHasExistingSchedule(metadata),
  }
}
