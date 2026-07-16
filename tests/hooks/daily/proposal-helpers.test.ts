import { describe, expect, it, vi } from 'vitest'
import { applyDailyScheduleProposal, buildProposalApplyOptions, proposalHasExistingSchedule } from '@/hooks/daily/proposal-helpers'
import type { DailySchedule } from '@/lib/daily-schedule'

const schedule: DailySchedule = {
  version: 2,
  timezone: 'Europe/Moscow',
  dayStartMinutes: 540,
  dayEndMinutes: 1080,
  blocks: [],
}

describe('proposal-helpers', () => {
  it('always confirms explicit apply click for a new schedule', () => {
    const metadata = { currentScheduleExists: false, currentScheduleHash: null }

    expect(proposalHasExistingSchedule(metadata)).toBe(false)
    expect(buildProposalApplyOptions(metadata)).toEqual({ confirmed: true, replaceExisting: false })
  })

  it('uses currentScheduleExists rather than nullable hash for replacement decision', () => {
    const metadata = { currentScheduleExists: true, currentScheduleHash: null }

    expect(proposalHasExistingSchedule(metadata)).toBe(true)
    expect(buildProposalApplyOptions(metadata)).toEqual({ confirmed: true, replaceExisting: true })
  })

  it('flushes pending schedule changes before applying a proposal', async () => {
    const calls: string[] = []
    const applySavedSchedule = vi.fn()
    const markChatProposalApplied = vi.fn()

    await applyDailyScheduleProposal({
      ensureEntrySaved: vi.fn(async () => {
        calls.push('ensure')
        return true
      }),
      flushScheduleChanges: vi.fn(async () => {
        calls.push('flush')
        return true
      }),
      applyProposalRequest: vi.fn(async () => {
        calls.push('apply')
        return { schedule, updatedAt: '2026-07-16T09:00:00.000Z' }
      }),
      applySavedSchedule,
      markChatProposalApplied,
      now: () => new Date('2026-07-16T09:01:00.000Z'),
    })

    expect(calls).toEqual(['ensure', 'flush', 'apply'])
    expect(applySavedSchedule).toHaveBeenCalledWith(schedule)
    expect(markChatProposalApplied).toHaveBeenCalledWith('2026-07-16T09:01:00.000Z')
  })

  it('does not apply a proposal when schedule flush fails', async () => {
    const applyProposalRequest = vi.fn(async () => ({ schedule, updatedAt: '2026-07-16T09:00:00.000Z' }))

    await expect(applyDailyScheduleProposal({
      ensureEntrySaved: vi.fn(async () => true),
      flushScheduleChanges: vi.fn(async () => false),
      applyProposalRequest,
      applySavedSchedule: vi.fn(),
      markChatProposalApplied: vi.fn(),
    })).rejects.toThrow('Не удалось сохранить изменения расписания. Расписание не применено.')

    expect(applyProposalRequest).not.toHaveBeenCalled()
  })
})
