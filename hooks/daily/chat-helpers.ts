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
