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
  /**
   * Обходит гейт attemptedDates. Нужен для явного действия пользователя (клик по CTA) —
   * иначе однажды проваленный/непроизведший сообщений авто-kickoff навсегда блокирует
   * повторный запуск для этой даты, пока не перезагрузится страница.
   */
  force?: boolean
}

export function shouldKickoffPlanChat({
  selectedDate,
  chatMessages,
  loadedDate,
  sendingChat,
  isSubmittingChat = false,
  attemptedDates,
  today = new Date(),
  force = false,
}: PlanChatKickoffGuardInput): boolean {
  if (selectedDate !== format(today, 'yyyy-MM-dd')) return false
  if (loadedDate !== selectedDate) return false
  if (chatMessages.length > 0) return false
  if (sendingChat || isSubmittingChat) return false
  if (!force && attemptedDates.has(selectedDate)) return false
  return true
}

// Видимость CTA не зависит от того, пробовали ли уже запускать kickoff:
// если чат по-прежнему пуст, кнопка должна оставаться доступной для повторного клика.
export function shouldShowPlanChatKickoffCta(input: PlanChatKickoffGuardInput): boolean {
  return shouldKickoffPlanChat({ ...input, force: true })
}
