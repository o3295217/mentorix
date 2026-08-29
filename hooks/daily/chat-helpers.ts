export function normalizeChatMessageId(id: unknown): string | undefined {
  if (id === null || id === undefined) return undefined
  return String(id)
}

export function isPendingChatMessageId(id: string | undefined): boolean {
  return Boolean(id?.startsWith('pending-'))
}

export function getBrowserTimezone(): string {
  try {
    if (typeof Intl === 'undefined') return 'UTC'
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export interface ChatProcessingPlaceholderState {
  sendingChat: boolean
  isSubmittingChat: boolean
  hasStreamingAssistantResponse: boolean
}

/**
 * Плейсхолдер-сообщение «Ассистент печатает…» показываем в ленте чата, пока
 * запрос отправляется/обрабатывается (sendingChat || isSubmittingChat), но
 * ещё не начал приходить видимый текст стрима или карточка предложения
 * (hasStreamingAssistantResponse). Как только появляется первый контент —
 * плейсхолдер уступает место реальному сообщению.
 */
export function shouldShowChatProcessingPlaceholder(state: ChatProcessingPlaceholderState): boolean {
  return (state.sendingChat || state.isSubmittingChat) && !state.hasStreamingAssistantResponse
}

/** Текст плейсхолдера: отличаем «применяем уже собранное расписание» от общего ожидания ответа. */
export function getChatProcessingPlaceholderText(applyingProposalId: string | null | undefined): string {
  return applyingProposalId ? 'Применяем расписание…' : 'Собираю ответ…'
}

interface StreamingAssistantMessageShell {
  role: 'user' | 'assistant'
  content: string
  metadata?: unknown
}

/**
 * Как только sendChatMessage() получает заголовки ответа, в chatMessages уже
 * лежит "пустая" ассистентская запись (content: ''), которую потом патчит
 * стрим. Пока showPlaceholder активен, эта пустая запись рендерилась бы как
 * дублирующий заголовок «Ассистент» рядом с плейсхолдером — прячем её.
 */
export function isEmptyStreamingAssistantShell(message: StreamingAssistantMessageShell): boolean {
  return message.role === 'assistant' && message.content.trim().length === 0 && !message.metadata
}
