export type SendDailyChatWithPreconditionsParams = {
  ensureEntrySaved: () => Promise<boolean>
  flushScheduleChanges: () => Promise<boolean>
  sendChatMessage: (initialMessage?: string) => Promise<void>
  showMessage: (text: string, duration?: number) => void
  initialMessage?: string
}

export async function sendDailyChatWithPreconditions({
  ensureEntrySaved,
  flushScheduleChanges,
  sendChatMessage,
  showMessage,
  initialMessage,
}: SendDailyChatWithPreconditionsParams): Promise<boolean> {
  const entrySaved = await ensureEntrySaved()
  if (!entrySaved) {
    showMessage('Не удалось сохранить текущий план. Сообщение не отправлено, чтобы Ассистент не увидел устаревшие задачи.')
    return false
  }

  const scheduleSaved = await flushScheduleChanges()
  if (!scheduleSaved) {
    showMessage('Не удалось сохранить изменения расписания. Сообщение не отправлено, чтобы Ассистент не увидел устаревший план.')
    return false
  }

  await sendChatMessage(initialMessage)
  return true
}
