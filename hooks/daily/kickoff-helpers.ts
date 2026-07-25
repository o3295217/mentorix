import { format } from 'date-fns'
import type { ChatMessage } from './types'

export const SYSTEM_KICKOFF_PLAN_CHAT = '[SYSTEM_KICKOFF_PLAN_CHAT]'

export type PlanChatKickoffGuardInput = {
  selectedDate: string
  chatMessages: ChatMessage[]
  loadedDate: string | null
  sendingChat: boolean
  isSubmittingChat?: boolean
  attemptedDates: ReadonlySet<string>
  today?: Date
}

export function shouldKickoffPlanChat({
  selectedDate,
  chatMessages,
  loadedDate,
  sendingChat,
  isSubmittingChat = false,
  attemptedDates,
  today = new Date(),
}: PlanChatKickoffGuardInput): boolean {
  if (selectedDate !== format(today, 'yyyy-MM-dd')) return false
  if (loadedDate !== selectedDate) return false
  if (chatMessages.length > 0) return false
  if (sendingChat || isSubmittingChat) return false
  if (attemptedDates.has(selectedDate)) return false
  return true
}

export function shouldShowPlanChatKickoffCta({
  selectedDate,
  chatMessages,
  loadedDate,
  sendingChat,
  isSubmittingChat = false,
  attemptedDates,
  today = new Date(),
}: PlanChatKickoffGuardInput): boolean {
  return shouldKickoffPlanChat({
    selectedDate,
    chatMessages,
    loadedDate,
    sendingChat,
    isSubmittingChat,
    attemptedDates,
    today,
  })
}
