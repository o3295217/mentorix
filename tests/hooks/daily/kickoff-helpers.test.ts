import { describe, expect, it } from 'vitest'
import { shouldKickoffPlanChat, shouldShowPlanChatKickoffCta } from '@/hooks/daily/kickoff-helpers'

const today = new Date('2026-07-23T10:00:00.000Z')

describe('kickoff-helpers', () => {
  it('allows one kickoff for today after empty history has loaded', () => {
    const attemptedDates = new Set<string>()

    expect(shouldKickoffPlanChat({
      selectedDate: '2026-07-23',
      chatMessages: [],
      loadedDate: '2026-07-23',
      sendingChat: false,
      attemptedDates,
      today,
    })).toBe(true)

    attemptedDates.add('2026-07-23')

    expect(shouldKickoffPlanChat({
      selectedDate: '2026-07-23',
      chatMessages: [],
      loadedDate: '2026-07-23',
      sendingChat: false,
      attemptedDates,
      today,
    })).toBe(false)
  })

  it('does not kickoff with existing history, in-flight request, unloaded history, or past date', () => {
    const base = {
      selectedDate: '2026-07-23',
      chatMessages: [],
      loadedDate: '2026-07-23',
      sendingChat: false,
      attemptedDates: new Set<string>(),
      today,
    }

    expect(shouldKickoffPlanChat({ ...base, chatMessages: [{ role: 'assistant', content: 'Привет' }] })).toBe(false)
    expect(shouldKickoffPlanChat({ ...base, sendingChat: true })).toBe(false)
    expect(shouldKickoffPlanChat({ ...base, isSubmittingChat: true })).toBe(false)
    expect(shouldKickoffPlanChat({ ...base, loadedDate: null })).toBe(false)
    expect(shouldKickoffPlanChat({ ...base, selectedDate: '2026-07-22', loadedDate: '2026-07-22' })).toBe(false)
  })

  it('shows kickoff CTA only for today after empty history loaded and before first attempt', () => {
    const base = {
      selectedDate: '2026-07-23',
      chatMessages: [],
      loadedDate: '2026-07-23',
      sendingChat: false,
      attemptedDates: new Set<string>(),
      today,
    }

    expect(shouldShowPlanChatKickoffCta(base)).toBe(true)
    expect(shouldShowPlanChatKickoffCta({ ...base, chatMessages: [{ role: 'assistant', content: 'Уже начали' }] })).toBe(false)
    expect(shouldShowPlanChatKickoffCta({ ...base, attemptedDates: new Set(['2026-07-23']) })).toBe(false)
    expect(shouldShowPlanChatKickoffCta({ ...base, sendingChat: true })).toBe(false)
    expect(shouldShowPlanChatKickoffCta({ ...base, selectedDate: '2026-07-22', loadedDate: '2026-07-22' })).toBe(false)
  })
})
