import { describe, expect, it, vi } from 'vitest'
import { applyDailyScheduleProposal, buildApplyProposalRequestBody, buildProposalApplyOptions, getProposalLoadSummary, parsePersistedNumericMessageId, proposalHasExistingSchedule, proposalMetadataToSchedule } from '@/hooks/daily/proposal-helpers'
import type { DailyScheduleProposalMetadata } from '@/lib/daily-schedule-proposal'
import type { DailySchedule } from '@/lib/daily-schedule'

const schedule: DailySchedule = {
  version: 2,
  timezone: 'Europe/Moscow',
  dayStartMinutes: 540,
  dayEndMinutes: 1080,
  blocks: [],
}

describe('proposal-helpers', () => {
  it('parses only positive safe numeric persisted message ids for explicit apply payload', () => {
    expect(parsePersistedNumericMessageId('55')).toBe(55)
    expect(parsePersistedNumericMessageId('1')).toBe(1)
    expect(parsePersistedNumericMessageId(undefined)).toBeNull()
    expect(parsePersistedNumericMessageId('')).toBeNull()
    expect(parsePersistedNumericMessageId('0')).toBeNull()
    expect(parsePersistedNumericMessageId('local-1')).toBeNull()
    expect(parsePersistedNumericMessageId('550e8400-e29b-41d4-a716-446655440000')).toBeNull()
    expect(parsePersistedNumericMessageId('9007199254740992')).toBeNull()
  })

  it('builds explicit apply request body with numeric messageId and rejects local ids', () => {
    expect(buildApplyProposalRequestBody({
      date: '2026-07-16',
      messageId: '55',
      options: { confirmed: true, replaceExisting: true },
      expectedCurrentScheduleHash: 'hash',
    })).toEqual({
      date: '2026-07-16',
      messageId: 55,
      confirmed: true,
      replaceExisting: true,
      expectedCurrentScheduleHash: 'hash',
    })
    expect(buildApplyProposalRequestBody({
      date: '2026-07-16',
      messageId: 'local-1',
      options: { confirmed: true, replaceExisting: false },
      expectedCurrentScheduleHash: null,
    })).toBeNull()
    expect(buildApplyProposalRequestBody({
      date: '2026-07-16',
      messageId: '550e8400-e29b-41d4-a716-446655440000',
      options: { confirmed: true, replaceExisting: false },
      expectedCurrentScheduleHash: null,
    })).toBeNull()
  })

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
    const applySavedSchedule = vi.fn(() => true)
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
    expect(applySavedSchedule).toHaveBeenCalledWith(schedule, undefined)
    expect(markChatProposalApplied).toHaveBeenCalledWith('2026-07-16T09:01:00.000Z')
  })

  it('does not apply a proposal when schedule flush fails', async () => {
    const applyProposalRequest = vi.fn(async () => ({ schedule, updatedAt: '2026-07-16T09:00:00.000Z' }))

    await expect(applyDailyScheduleProposal({
      ensureEntrySaved: vi.fn(async () => true),
      flushScheduleChanges: vi.fn(async () => false),
      applyProposalRequest,
      applySavedSchedule: vi.fn(() => true),
      markChatProposalApplied: vi.fn(),
    })).rejects.toThrow('Не удалось сохранить изменения расписания. Расписание не применено.')

    expect(applyProposalRequest).not.toHaveBeenCalled()
  })

  it('keeps v2 server load summary percentages and minutes', () => {
    const metadata: DailyScheduleProposalMetadata = {
      type: 'daily_schedule_proposal',
      schemaVersion: 2,
      date: '2026-07-16',
      createdAt: '2026-07-16T08:00:00.000Z',
      currentScheduleExists: false,
      currentScheduleHash: null,
      appliedAt: null,
      proposal: {
        version: 2,
        date: '2026-07-16',
        timezone: 'Europe/Moscow',
        dayStartMinutes: 9 * 60,
        dayEndMinutes: 21 * 60 + 30,
        planningBasis: 'day_start',
        planningStartMinutes: 9 * 60,
        workEndMinutes: 18 * 60,
        activityEndMinutes: 21 * 60 + 30,
        blocks: [
          { kind: 'task', taskIndex: 1, taskText: 'Фокус', category: 'main', isFixed: false, startMinutes: 9 * 60 + 30, durationMinutes: 90 },
          { kind: 'buffer', title: 'Дорога', category: 'travel', isFixed: true, startMinutes: 18 * 60, durationMinutes: 120 },
        ],
      },
      loadSummary: {
        activeInterval: { startMinutes: 9 * 60, endMinutes: 21 * 60 + 30, availableMinutes: 750 },
        workInterval: { startMinutes: 9 * 60, endMinutes: 18 * 60, availableMinutes: 540 },
        scheduledMinutes: 210,
        unscheduledMinutes: 540,
        scheduledPercent: 28,
        unscheduledPercent: 72,
        workScheduledMinutes: 90,
        workUnscheduledMinutes: 450,
        workScheduledPercent: 16.67,
        categories: {
          main: { minutes: 90, percent: 12, workMinutes: 90, workPercent: 16.67 },
          operational: { minutes: 0, percent: 0, workMinutes: 0, workPercent: 0 },
          travel: { minutes: 120, percent: 16, workMinutes: 0, workPercent: 0 },
          personal: { minutes: 0, percent: 0, workMinutes: 0, workPercent: 0 },
          meal: { minutes: 0, percent: 0, workMinutes: 0, workPercent: 0 },
          rest: { minutes: 0, percent: 0, workMinutes: 0, workPercent: 0 },
          buffer: { minutes: 0, percent: 0, workMinutes: 0, workPercent: 0 },
        },
        loadLevel: 'light',
        recommendation: 'server recommendation',
      },
    }

    expect(getProposalLoadSummary(metadata).recommendation).toBe('server recommendation')
    expect(getProposalLoadSummary(metadata).categories.travel.minutes).toBe(120)
    expect(proposalMetadataToSchedule(metadata).blocks.map(block => [block.startMinutes, block.durationMinutes])).toEqual([[570, 90], [1080, 120]])
  })

  it('falls back for v1 metadata without server load summary', () => {
    const metadata: DailyScheduleProposalMetadata = {
      type: 'daily_schedule_proposal',
      schemaVersion: 1,
      date: '2026-07-16',
      createdAt: '2026-07-16T08:00:00.000Z',
      currentScheduleExists: false,
      currentScheduleHash: null,
      appliedAt: null,
      proposal: {
        version: 1,
        date: '2026-07-16',
        timezone: 'Europe/Moscow',
        dayStartMinutes: 9 * 60,
        dayEndMinutes: 18 * 60,
        blocks: [{ kind: 'task', taskIndex: 1, taskText: 'Фокус', startMinutes: 9 * 60 + 30, durationMinutes: 45 }],
      },
    }

    const summary = getProposalLoadSummary(metadata)
    expect(summary.scheduledMinutes).toBe(45)
    expect(summary.scheduledPercent).toBe(8.33)
    expect(summary.categories.main.minutes).toBe(45)
  })
})
