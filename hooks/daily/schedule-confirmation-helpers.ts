import type { DailyScheduleProposalMetadata } from '@/lib/daily-schedule-proposal'
import type { ChatMessage } from './types'
import { isPendingChatMessageId } from './chat-helpers'

const strictScheduleConfirmationPhrases = new Set([
  'да',
  'ок',
  'окей',
  'размести',
  'примени',
  'применить',
])

export function isStrictScheduleConfirmation(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ')
  return strictScheduleConfirmationPhrases.has(normalized)
}

export type PendingScheduleProposalSelection = {
  messageId: string
  metadata: DailyScheduleProposalMetadata
}

export function selectLatestVisiblePendingScheduleProposal(
  messages: ChatMessage[],
  dismissedProposalIds: Set<string>,
): PendingScheduleProposalSelection | null {
  const last = messages.at(-1)
  if (!last || last.role !== 'assistant') return null
  if (!last.id || isPendingChatMessageId(last.id) || !/^[1-9]\d*$/.test(last.id) || dismissedProposalIds.has(last.id)) return null
  const metadata = last.metadata
  if (!metadata || metadata.type !== 'daily_schedule_proposal' || metadata.appliedAt) return null
  return { messageId: last.id, metadata }
}

export function selectStrictScheduleConfirmationProposal(
  text: string,
  messages: ChatMessage[],
  dismissedProposalIds: Set<string>,
): PendingScheduleProposalSelection | null {
  if (!isStrictScheduleConfirmation(text)) return null
  return selectLatestVisiblePendingScheduleProposal(messages, dismissedProposalIds)
}
