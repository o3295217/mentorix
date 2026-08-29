import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getBrowserTimezone,
  getChatProcessingPlaceholderText,
  isEmptyStreamingAssistantShell,
  isPendingChatMessageId,
  normalizeChatMessageId,
  shouldShowChatProcessingPlaceholder,
} from '@/hooks/daily/chat-helpers'

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

describe('shouldShowChatProcessingPlaceholder', () => {
  it('shows the placeholder while the request is submitting, before sendingChat flips on', () => {
    expect(shouldShowChatProcessingPlaceholder({
      sendingChat: false,
      isSubmittingChat: true,
      hasStreamingAssistantResponse: false,
    })).toBe(true)
  })

  it('shows the placeholder while sending but no stream content has arrived yet', () => {
    expect(shouldShowChatProcessingPlaceholder({
      sendingChat: true,
      isSubmittingChat: false,
      hasStreamingAssistantResponse: false,
    })).toBe(true)
  })

  it('hides the placeholder once the assistant response starts streaming', () => {
    expect(shouldShowChatProcessingPlaceholder({
      sendingChat: true,
      isSubmittingChat: false,
      hasStreamingAssistantResponse: true,
    })).toBe(false)
  })

  it('hides the placeholder when nothing is in flight', () => {
    expect(shouldShowChatProcessingPlaceholder({
      sendingChat: false,
      isSubmittingChat: false,
      hasStreamingAssistantResponse: false,
    })).toBe(false)
  })
})

describe('getChatProcessingPlaceholderText', () => {
  it('uses the generic composing label by default', () => {
    expect(getChatProcessingPlaceholderText(null)).toBe('Собираю ответ…')
    expect(getChatProcessingPlaceholderText(undefined)).toBe('Собираю ответ…')
  })

  it('switches to the apply-schedule label while a proposal is being applied', () => {
    expect(getChatProcessingPlaceholderText('msg-42')).toBe('Применяем расписание…')
  })
})

describe('isEmptyStreamingAssistantShell', () => {
  it('flags a freshly-added assistant message with no content and no metadata yet', () => {
    expect(isEmptyStreamingAssistantShell({ role: 'assistant', content: '', metadata: undefined })).toBe(true)
    expect(isEmptyStreamingAssistantShell({ role: 'assistant', content: '   ', metadata: null })).toBe(true)
  })

  it('does not flag a user message', () => {
    expect(isEmptyStreamingAssistantShell({ role: 'user', content: '' })).toBe(false)
  })

  it('does not flag an assistant message that already has text', () => {
    expect(isEmptyStreamingAssistantShell({ role: 'assistant', content: 'Собираю расписание' })).toBe(false)
  })

  it('does not flag an assistant message that already carries proposal metadata', () => {
    expect(isEmptyStreamingAssistantShell({ role: 'assistant', content: '', metadata: { type: 'daily_schedule_proposal' } })).toBe(false)
  })
})
