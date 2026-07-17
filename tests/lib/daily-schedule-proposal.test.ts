import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProposalMetadata, proposalToDailySchedule, proposalToDailyScheduleV2, proposalToDailyScheduleV3, safeParseProposalMetadata, validateProposalAgainstCurrentPlan, type DailyScheduleProposal, type DailyScheduleProposalV2 } from '@/lib/daily-schedule-proposal'

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

const proposalV2: DailyScheduleProposalV2 = {
  version: 2,
  date: '2026-02-28',
  timezone: 'Europe/Moscow',
  dayStartMinutes: 9 * 60 + 30,
  dayEndMinutes: 21 * 60 + 30,
  planningBasis: 'current_time',
  planningStartMinutes: 9 * 60 + 30,
  workEndMinutes: 18 * 60,
  activityEndMinutes: 21 * 60 + 30,
  blocks: [
    { kind: 'task', taskIndex: 1, taskText: 'Deep work', category: 'main', isFixed: false, startMinutes: 10 * 60, durationMinutes: 45 },
    { kind: 'task', taskIndex: 2, taskText: 'Review', category: 'main', isFixed: false, startMinutes: 11 * 60, durationMinutes: 90 },
    { kind: 'buffer', title: 'Personal', category: 'personal', isFixed: true, startMinutes: 18 * 60, durationMinutes: 120 },
    { kind: 'buffer', title: 'Travel', category: 'travel', isFixed: true, startMinutes: 20 * 60, durationMinutes: 90 },
  ],
}

describe('daily schedule proposal', () => {
  it('validates task blocks against current plan and transforms to v2 schedule', () => {
    const validation = validateProposalAgainstCurrentPlan(proposal, { date: '2026-02-28', timezone: 'Europe/Moscow', planTasks: ['Deep work'] })

    expect(validation.success).toBe(true)
    expect(proposalToDailyScheduleV2(proposal)).toMatchObject({
      version: 2,
      blocks: [
        { id: 'srv-5d780677ec266150', kind: 'task', taskIndex: 1, taskText: 'Deep work' },
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

  it('validates proposal v2 and converts it to schedule v3 with planning/category/isFixed', () => {
    const validation = validateProposalAgainstCurrentPlan(proposalV2, { date: '2026-02-28', timezone: 'Europe/Moscow', planTasks: ['Deep work', 'Review'] })

    expect(validation.success).toBe(true)
    expect(proposalToDailyScheduleV3(proposalV2)).toMatchObject({
      version: 3,
      planningBasis: 'current_time',
      planningStartMinutes: 570,
      workEndMinutes: 1080,
      activityEndMinutes: 1290,
      blocks: [
        { kind: 'task', category: 'main', isFixed: false, taskIndex: 1 },
        { kind: 'task', category: 'main', isFixed: false, taskIndex: 2 },
        { kind: 'buffer', category: 'personal', isFixed: true },
        { kind: 'buffer', category: 'travel', isFixed: true },
      ],
    })
    expect(proposalToDailySchedule(proposalV2).version).toBe(3)
  })

  it('rejects proposal v2 with invalid time step through full schedule validation', () => {
    const validation = validateProposalAgainstCurrentPlan({ ...proposalV2, planningStartMinutes: 571 }, { date: '2026-02-28', timezone: 'Europe/Moscow', planTasks: ['Deep work', 'Review'] })

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

  it('creates metadata schemaVersion 2 with server-computed load summary for v2 proposals', () => {
    const metadata = createProposalMetadata({ date: '2026-02-28', proposal: proposalV2, currentScheduleHash: null, currentScheduleExists: false, createdAt: new Date('2026-02-28T10:00:00.000Z') })
    expect(metadata.schemaVersion).toBe(2)
    const parsed = safeParseProposalMetadata({ ...metadata, loadSummary: { ...metadata.loadSummary, scheduledMinutes: 1 } })

    expect(metadata.loadSummary.scheduledMinutes).toBe(345)
    expect(metadata.loadSummary.scheduledPercent).toBe(47.92)
    expect(parsed?.schemaVersion).toBe(2)
    if (parsed?.schemaVersion !== 2) throw new Error('Expected schemaVersion 2 metadata')
    expect(parsed.loadSummary.scheduledMinutes).toBe(345)
  })
})
