import { describe, expect, it } from 'vitest'
import {
  GOALS_CHAT_DRAFT_KEY,
  calculateChatViewportMetrics,
  getBottomObstructionInset,
  getDailyChatDraftKey,
  getScrollAdjustmentForVisibility,
  isChatNearBottom,
  shouldKeepChatAtBottom,
} from '@/hooks/chat-viewport-helpers'

describe('chat viewport helpers', () => {
  it('detects whether the reader is near the bottom with a threshold', () => {
    expect(isChatNearBottom({ scrollTop: 620, scrollHeight: 1000, clientHeight: 300 })).toBe(true)
    expect(isChatNearBottom({ scrollTop: 500, scrollHeight: 1000, clientHeight: 300 })).toBe(false)
  })

  it('keeps sticky scrolling only for a reader at the bottom unless forced', () => {
    expect(shouldKeepChatAtBottom(true)).toBe(true)
    expect(shouldKeepChatAtBottom(false)).toBe(false)
    expect(shouldKeepChatAtBottom(false, true)).toBe(true)
  })

  it('calculates visual viewport height and keyboard inset', () => {
    expect(calculateChatViewportMetrics({ layoutHeight: 800, viewportHeight: 500, offsetTop: 0 })).toEqual({
      height: 500,
      offsetTop: 0,
      keyboardInset: 300,
      keyboardVisible: true,
    })
    expect(calculateChatViewportMetrics({ layoutHeight: 800 })).toEqual({
      height: 800,
      offsetTop: 0,
      keyboardInset: 0,
      keyboardVisible: false,
    })
  })

  it('only scrolls the page when the focused composer is outside the visual viewport', () => {
    expect(getScrollAdjustmentForVisibility({
      targetTop: 420,
      targetBottom: 470,
      viewportTop: 0,
      viewportHeight: 450,
      padding: 12,
    })).toBe(32)
    expect(getScrollAdjustmentForVisibility({
      targetTop: 100,
      targetBottom: 144,
      viewportTop: 0,
      viewportHeight: 450,
    })).toBe(0)
  })

  it('reserves a visible fixed bottom navigation only when explicitly requested', () => {
    const bottomInset = getBottomObstructionInset({
      viewportTop: 0,
      viewportHeight: 800,
      obstructionTop: 736,
    })
    expect(bottomInset).toBe(64)
    expect(getScrollAdjustmentForVisibility({
      targetTop: 700,
      targetBottom: 744,
      viewportTop: 0,
      viewportHeight: 800,
      bottomInset,
      padding: 12,
    })).toBe(20)
    expect(getBottomObstructionInset({
      viewportTop: 0,
      viewportHeight: 500,
      obstructionTop: 736,
    })).toBe(0)
  })

  it('uses a session-wide goals key and isolates daily drafts by date', () => {
    expect(GOALS_CHAT_DRAFT_KEY).toBe('mentorix:chat-draft:goals')
    expect(getDailyChatDraftKey('2026-07-19')).toBe('mentorix:chat-draft:daily:2026-07-19')
    expect(getDailyChatDraftKey('2026-07-20')).not.toBe(getDailyChatDraftKey('2026-07-19'))
  })
})
