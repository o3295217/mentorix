import { afterEach, describe, expect, it, vi } from 'vitest'
import { isStrictScheduleChangeRequest, isStrictScheduleConfirmation } from '@/lib/daily-schedule-intent'

afterEach(() => vi.unstubAllEnvs())

describe('daily schedule intent helpers', () => {
  it('matches concrete schedule change requests only with schedule/time semantics', () => {
    expect(isStrictScheduleChangeRequest('Передвинь карточку задачи на 10:00 в расписании')).toBe(true)
    expect(isStrictScheduleChangeRequest('измени график после обеда')).toBe(true)
    expect(isStrictScheduleChangeRequest('передвинь идею в голове')).toBe(false)
    expect(isStrictScheduleChangeRequest('что у меня в расписании?')).toBe(false)
  })

  it('matches strict confirmations and rejects negatives/questions/qualified replies', () => {
    expect(isStrictScheduleConfirmation('да')).toBe(true)
    expect(isStrictScheduleConfirmation('размести')).toBe(true)
    expect(isStrictScheduleConfirmation('подтверждаю')).toBe(true)
    expect(isStrictScheduleConfirmation('не надо')).toBe(false)
    expect(isStrictScheduleConfirmation('да, но объясни')).toBe(false)
    expect(isStrictScheduleConfirmation('да?')).toBe(false)
  })
})
