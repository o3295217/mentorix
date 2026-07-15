import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProposalMetadata, proposalToDailyScheduleV2, safeParseProposalMetadata, validateProposalAgainstCurrentPlan, type DailyScheduleProposal } from '@/lib/daily-schedule-proposal'

afterEach(() => {
  vi.unstubAllEnvs()
})

const proposal: DailyScheduleProposal = {
  version: 1,
  date: '2026-02-28',
  timezone: 'Europe/Moscow',
  dayStartMinutes: 8 * 60,
  dayEndMinutes: 18 * 60,
  blocks: [
    { kind: 'task', taskIndex: 1, taskText: 'Deep work', startMinutes: 9 * 60, durationMinutes: 60 },
    { kind: 'rest', title: 'Break', startMinutes: 10 * 60, durationMinutes: 15 },
  ],
}

describe('daily schedule proposal', () => {
  it('validates task blocks against current plan and transforms to v2 schedule', () => {
    const validation = validateProposalAgainstCurrentPlan(proposal, { date: '2026-02-28', timezone: 'Europe/Moscow', planTasks: ['Deep work'] })

    expect(validation.success).toBe(true)
    expect(proposalToDailyScheduleV2(proposal)).toMatchObject({
      version: 2,
      blocks: [
        { kind: 'task', taskIndex: 1, taskText: 'Deep work' },
        { kind: 'rest', title: 'Break' },
      ],
    })
  })

  it('rejects model-invented task blocks', () => {
    const validation = validateProposalAgainstCurrentPlan({ ...proposal, blocks: [{ kind: 'task', taskIndex: 2, taskText: 'Invented', startMinutes: 9 * 60, durationMinutes: 60 }] }, { date: '2026-02-28', timezone: 'Europe/Moscow', planTasks: ['Deep work'] })

    expect(validation.success).toBe(false)
  })

  it('rejects proposal timezone mismatch', () => {
    const validation = validateProposalAgainstCurrentPlan(proposal, { date: '2026-02-28', timezone: 'Asia/Tbilisi', planTasks: ['Deep work'] })

    expect(validation.success).toBe(false)
  })

  it('round-trips safe metadata schema', () => {
    const metadata = createProposalMetadata({ date: '2026-02-28', proposal, currentScheduleHash: null, currentScheduleExists: false, createdAt: new Date('2026-02-28T10:00:00.000Z') })

    expect(safeParseProposalMetadata(metadata)).toEqual(metadata)
    expect(safeParseProposalMetadata({ ...metadata, type: 'unknown' })).toBeNull()
  })

  it('parses old metadata with currentScheduleExists defaulted from hash', () => {
    const metadata = createProposalMetadata({ date: '2026-02-28', proposal, currentScheduleHash: 'a'.repeat(64), currentScheduleExists: true })
    const { currentScheduleExists, ...oldMetadata } = metadata

    expect(currentScheduleExists).toBe(true)
    expect(safeParseProposalMetadata(oldMetadata)?.currentScheduleExists).toBe(true)
  })
})
