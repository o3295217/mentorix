import { describe, expect, it, vi } from 'vitest'
import { sendDailyChatWithPreconditions } from '@/hooks/daily/chat-submit-helpers'
describe('sendDailyChatWithPreconditions', () => {
  it('runs ensure entry → flush schedule → send without applying chat schedules', async () => {
    const calls: string[] = []

    await expect(sendDailyChatWithPreconditions({
      ensureEntrySaved: vi.fn(async () => {
        calls.push('ensure')
        return true
      }),
      flushScheduleChanges: vi.fn(async () => {
        calls.push('flush')
        return true
      }),
      sendChatMessage: vi.fn(async () => {
        calls.push('send')
      }),
      showMessage: vi.fn(),
      initialMessage: 'да, размести',
    })).resolves.toBe(true)

    expect(calls).toEqual(['ensure', 'flush', 'send'])
  })

  it('short-circuits when entry save fails', async () => {
    const flushScheduleChanges = vi.fn(async () => true)
    const sendChatMessage = vi.fn(async () => undefined)
    const showMessage = vi.fn()

    await expect(sendDailyChatWithPreconditions({
      ensureEntrySaved: vi.fn(async () => false),
      flushScheduleChanges,
      sendChatMessage,
      showMessage,
    })).resolves.toBe(false)

    expect(flushScheduleChanges).not.toHaveBeenCalled()
    expect(sendChatMessage).not.toHaveBeenCalled()
    expect(showMessage).toHaveBeenCalledWith(expect.stringContaining('Не удалось сохранить текущий план'))
  })

  it('short-circuits when schedule flush fails after entry save', async () => {
    const sendChatMessage = vi.fn(async () => undefined)
    const showMessage = vi.fn()

    await expect(sendDailyChatWithPreconditions({
      ensureEntrySaved: vi.fn(async () => true),
      flushScheduleChanges: vi.fn(async () => false),
      sendChatMessage,
      showMessage,
    })).resolves.toBe(false)

    expect(sendChatMessage).not.toHaveBeenCalled()
    expect(showMessage).toHaveBeenCalledWith(expect.stringContaining('Не удалось сохранить изменения расписания'))
  })
})
