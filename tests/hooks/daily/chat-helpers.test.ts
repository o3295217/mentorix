import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBrowserTimezone, isPendingChatMessageId, normalizeChatMessageId } from '@/hooks/daily/chat-helpers'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('chat-helpers', () => {
  it('normalizes numeric server ids to strings', () => {
    expect(normalizeChatMessageId(42)).toBe('42')
    expect(normalizeChatMessageId('msg-1')).toBe('msg-1')
    expect(normalizeChatMessageId(null)).toBeUndefined()
  })

  it('detects only temporary pending ids', () => {
    expect(isPendingChatMessageId('pending-123')).toBe(true)
    expect(isPendingChatMessageId('42')).toBe(false)
    expect(isPendingChatMessageId(undefined)).toBe(false)
  })

  it('returns browser timezone and falls back to UTC on empty value or exception', () => {
    vi.stubGlobal('Intl', {
      DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: 'Europe/Moscow' }) }),
    })
    expect(getBrowserTimezone()).toBe('Europe/Moscow')

    vi.stubGlobal('Intl', {
      DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: '' }) }),
    })
    expect(getBrowserTimezone()).toBe('UTC')

    vi.stubGlobal('Intl', {
      DateTimeFormat: () => {
        throw new Error('blocked')
      },
    })
    expect(getBrowserTimezone()).toBe('UTC')
  })
})
