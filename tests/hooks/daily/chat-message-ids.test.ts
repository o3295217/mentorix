import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDailyChatTempMessageId, getDailyChatMessageRenderKey } from '@/hooks/daily/useDailyController'
import { isPendingChatMessageId } from '@/hooks/daily/chat-helpers'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('daily chat message ids', () => {
  it('keeps render keys unique when server numeric ids coexist with messages without ids', () => {
    const messages = [
      { id: '1' },
      {},
      { id: '2' },
      {},
    ]

    const keys = messages.map(getDailyChatMessageRenderKey)

    expect(keys).toEqual(['1', 'idx-1', '2', 'idx-3'])
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('creates distinct temporary ids even when uuid source repeats', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'same-uuid' })

    const userId = createDailyChatTempMessageId('local-user')
    const assistantId = createDailyChatTempMessageId('pending')

    expect(userId).toMatch(/^local-user-\d+-same-uuid$/)
    expect(assistantId).toMatch(/^pending-\d+-same-uuid$/)
    expect(userId).not.toBe(assistantId)
    expect(isPendingChatMessageId(userId)).toBe(false)
    expect(isPendingChatMessageId(assistantId)).toBe(true)
  })
})
