import { afterEach, describe, expect, it, vi } from 'vitest'
import { DailyScheduleSchema, findScheduleOverlaps } from '@/lib/daily-schedule'
import {
  DailyScheduleProposalSchema,
  DailyScheduleProposalV1Schema,
  DailyScheduleProposalV2Schema,
  DailyScheduleProposalV3Schema,
  createProposalMetadata,
  getDailyScheduleProposalNormalizationResult,
  getNewTasksFromProposal,
  hashDailyPlanTasks,
  normalizeDailyScheduleProposalToolInput,
  proposalToDailySchedule,
  proposalToDailyScheduleV2,
  proposalToDailyScheduleV3,
  safeParseProposalMetadata,
  validateProposalAgainstCurrentPlan,
  type DailyScheduleProposal,
  type DailyScheduleProposalV2,
  type DailyScheduleProposalV3,
} from '@/lib/daily-schedule-proposal'

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

const proposalV3: DailyScheduleProposalV3 = {
  version: 3,
  date: '2026-02-28',
  timezone: 'Europe/Moscow',
  dayStartMinutes: 9 * 60,
  dayEndMinutes: 19 * 60,
  planningBasis: 'day_start',
  planningStartMinutes: 9 * 60,
  workEndMinutes: 18 * 60,
  activityEndMinutes: 19 * 60,
  newTasks: ['Call accountant', 'Book tickets'],
  blocks: [
    { kind: 'task', taskSource: 'existing', taskIndex: 1, taskText: 'Deep work', category: 'main', isFixed: false, startMinutes: 9 * 60, durationMinutes: 60 },
    { kind: 'task', taskSource: 'new', taskIndex: 1, taskText: 'Call accountant', category: 'operational', isFixed: false, startMinutes: 10 * 60 + 15, durationMinutes: 30 },
    { kind: 'task', taskSource: 'new', taskIndex: 2, taskText: 'Book tickets', category: 'personal', isFixed: false, startMinutes: 11 * 60, durationMinutes: 30 },
    { kind: 'meal', title: 'Lunch', category: 'meal', isFixed: true, startMinutes: 13 * 60, durationMinutes: 60 },
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

  it('accepts proposal v2 planning start on the minute grid through full schedule validation', () => {
    const validation = validateProposalAgainstCurrentPlan({ ...proposalV2, dayStartMinutes: 571, planningStartMinutes: 571 }, { date: '2026-02-28', timezone: 'Europe/Moscow', planTasks: ['Deep work', 'Review'] })

    expect(validation.success).toBe(true)
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

  it('parses valid proposal v3 with deterministic new tasks list', () => {
    const validation = DailyScheduleProposalV3Schema.safeParse(proposalV3)

    expect(validation.success).toBe(true)
    if (!validation.success) throw new Error('Expected valid v3 proposal')
    expect(getNewTasksFromProposal(validation.data)).toEqual(['Call accountant', 'Book tickets'])
    expect(DailyScheduleProposalSchema.safeParse(proposalV3).success).toBe(true)
  })

  it('normalizes taskText from source of truth and keeps v3 new task references strict', () => {
    expect(DailyScheduleProposalV3Schema.safeParse({
      ...proposalV3,
      blocks: [
        proposalV3.blocks[0],
        { kind: 'task', taskSource: 'new', taskIndex: 1, taskText: 'Different text', category: 'operational', isFixed: false, startMinutes: 10 * 60 + 5, durationMinutes: 30 },
        proposalV3.blocks[2],
      ],
    }).success).toBe(true)

    const normalized = normalizeDailyScheduleProposalToolInput({
      ...proposalV3,
      blocks: [{ ...proposalV3.blocks[1], taskText: 'Different text' }],
    }) as DailyScheduleProposalV3

    expect(normalized.blocks[0]).toMatchObject({ taskText: 'Call accountant' })

    expect(DailyScheduleProposalV3Schema.safeParse({
      ...proposalV3,
      newTasks: Array.from({ length: 11 }, (_, index) => `New task ${index + 1}`),
    }).success).toBe(false)
  })

  it('allows v3 newTasks without schedule blocks', () => {
    const proposalWithUnscheduledNewTask: DailyScheduleProposalV3 = {
      ...proposalV3,
      newTasks: ['Call accountant', 'Book tickets', 'Buy milk'],
      blocks: proposalV3.blocks.filter(block => !(block.kind === 'task' && block.taskSource === 'new' && block.taskIndex === 2)),
    }

    expect(DailyScheduleProposalV3Schema.safeParse(proposalWithUnscheduledNewTask).success).toBe(true)
    const validation = validateProposalAgainstCurrentPlan(proposalWithUnscheduledNewTask, { date: '2026-02-28', timezone: 'Europe/Moscow', planTasks: ['Deep work'] })
    expect(validation.success).toBe(true)
  })

  it('keeps new task block references to unknown newTasks indexes strict', () => {
    expect(DailyScheduleProposalV3Schema.safeParse({
      ...proposalV3,
      blocks: [
        proposalV3.blocks[0],
        { kind: 'task', taskSource: 'new', taskIndex: 3, taskText: 'Unknown task', category: 'operational', isFixed: false, startMinutes: 10 * 60 + 15, durationMinutes: 30 },
      ],
    }).success).toBe(false)
  })

  it('normalizes v2 and v3 tool block times to the nearest minute and clamps minimum duration', () => {
    const normalizedV2 = normalizeDailyScheduleProposalToolInput({
      ...proposalV2,
      blocks: [
        { ...proposalV2.blocks[0], startMinutes: 0, durationMinutes: 0 },
        { ...proposalV2.blocks[1], startMinutes: 547, durationMinutes: 7 },
        { kind: 'buffer', title: 'Late', category: 'buffer', isFixed: false, startMinutes: 1438, durationMinutes: 1448 },
      ],
    })
    expect(normalizedV2).toMatchObject({
      blocks: [
        { startMinutes: 0, durationMinutes: 15 },
        { startMinutes: 547, durationMinutes: 15 },
        { startMinutes: 1438, durationMinutes: 1440 },
      ],
    })

    const normalizedV3 = normalizeDailyScheduleProposalToolInput({
      ...proposalV3,
      dayStartMinutes: 548,
      planningStartMinutes: 548,
      workEndMinutes: 18 * 60,
      activityEndMinutes: 19 * 60,
      blocks: [
        { ...proposalV3.blocks[0], startMinutes: 548, durationMinutes: 22 },
        { ...proposalV3.blocks[1], startMinutes: 553, durationMinutes: 23 },
      ],
    })
    expect(normalizedV3).toMatchObject({
      blocks: [
        { startMinutes: 548, durationMinutes: 22 },
        { startMinutes: 570, durationMinutes: 23 },
      ],
    })
  })

  it('separates two overlapping flexible blocks while preserving durations and chronological order', () => {
    const normalized = normalizeDailyScheduleProposalToolInput({
      ...proposalV3,
      blocks: [
        { ...proposalV3.blocks[0], startMinutes: 9 * 60, durationMinutes: 60, isFixed: false },
        { ...proposalV3.blocks[1], startMinutes: 9 * 60 + 30, durationMinutes: 30, isFixed: false },
      ],
    }) as DailyScheduleProposalV3

    expect(normalized.blocks).toMatchObject([
      { startMinutes: 9 * 60, durationMinutes: 60 },
      { startMinutes: 10 * 60, durationMinutes: 30 },
    ])
    expect(findScheduleOverlaps(proposalToDailySchedule(normalized, { currentPlanTaskCount: 1 }).blocks)).toEqual([])
    expect(validateProposalAgainstCurrentPlan(normalized, { date: proposalV3.date, timezone: proposalV3.timezone, planTasks: ['Deep work'] }).success).toBe(true)
  })

  it('keeps fixed block in place and moves overlapping flexible block even when flexible block starts earlier', () => {
    const normalized = normalizeDailyScheduleProposalToolInput({
      ...proposalV3,
      blocks: [
        { ...proposalV3.blocks[0], startMinutes: 9 * 60 + 30, durationMinutes: 60, isFixed: false },
        { ...proposalV3.blocks[3], startMinutes: 10 * 60, durationMinutes: 30, isFixed: true },
      ],
    }) as DailyScheduleProposalV3

    expect(normalized.blocks[0]).toMatchObject({ startMinutes: 9 * 60, durationMinutes: 60, isFixed: false })
    expect(normalized.blocks[1]).toMatchObject({ startMinutes: 10 * 60, durationMinutes: 30, isFixed: true })
    expect(findScheduleOverlaps(proposalToDailySchedule(normalized, { currentPlanTaskCount: 1 }).blocks)).toEqual([])
    expect(validateProposalAgainstCurrentPlan(normalized, { date: proposalV3.date, timezone: proposalV3.timezone, planTasks: ['Deep work'] }).success).toBe(true)
  })

  it('keeps two overlapping fixed blocks for strict schedule validation to reject', () => {
    const normalized = normalizeDailyScheduleProposalToolInput({
      ...proposalV3,
      blocks: [
        { ...proposalV3.blocks[0], startMinutes: 9 * 60, durationMinutes: 60, isFixed: true },
        { ...proposalV3.blocks[3], startMinutes: 9 * 60 + 30, durationMinutes: 60, isFixed: true },
      ],
    }) as DailyScheduleProposalV3

    expect(normalized.blocks).toMatchObject([
      { startMinutes: 9 * 60, durationMinutes: 60, isFixed: true },
      { startMinutes: 9 * 60 + 30, durationMinutes: 60, isFixed: true },
    ])
    expect(DailyScheduleProposalV3Schema.safeParse(normalized).success).toBe(true)
    expect(DailyScheduleSchema.safeParse(proposalToDailySchedule(normalized, { currentPlanTaskCount: 1 })).success).toBe(false)
  })

  it('removes flexible blocks that do not fit and returns unscheduled block information', () => {
    const normalized = normalizeDailyScheduleProposalToolInput({
      ...proposalV3,
      dayStartMinutes: 9 * 60,
      dayEndMinutes: 10 * 60,
      planningStartMinutes: 9 * 60,
      workEndMinutes: 10 * 60,
      activityEndMinutes: 10 * 60,
      newTasks: [],
      blocks: [
        { kind: 'task', taskSource: 'existing', taskIndex: 1, taskText: 'Model text 1', category: 'main', isFixed: false, startMinutes: 9 * 60, durationMinutes: 30 },
        { kind: 'task', taskSource: 'existing', taskIndex: 2, taskText: 'Model text 2', category: 'main', isFixed: false, startMinutes: 9 * 60 + 15, durationMinutes: 30 },
        { kind: 'task', taskSource: 'existing', taskIndex: 3, taskText: 'Model text 3', category: 'main', isFixed: false, startMinutes: 9 * 60 + 30, durationMinutes: 30 },
      ],
    }) as DailyScheduleProposalV3

    expect(normalized.blocks).toMatchObject([
      { taskIndex: 1, startMinutes: 9 * 60, durationMinutes: 30 },
      { taskIndex: 2, startMinutes: 9 * 60 + 30, durationMinutes: 30 },
    ])
    expect(getDailyScheduleProposalNormalizationResult(normalized)).toEqual({
      unscheduledBlocks: [expect.objectContaining({ originalIndex: 2, reason: 'does_not_fit', task: expect.objectContaining({ taskSource: 'existing', taskIndex: 3 }) })],
    })
    const validation = validateProposalAgainstCurrentPlan(normalized, { date: proposalV3.date, timezone: proposalV3.timezone, planTasks: ['Deep work', 'Review', 'Third task'] })
    expect(validation.success).toBe(true)
    expect(DailyScheduleSchema.safeParse(proposalToDailySchedule(normalized, { currentPlanTaskCount: 3 })).success).toBe(true)
  })

  it('overwrites existing taskText from current plan instead of rejecting mismatches', () => {
    const normalized = normalizeDailyScheduleProposalToolInput({
      ...proposalV3,
      blocks: [
        { ...proposalV3.blocks[0], taskText: 'Wrong text from model' },
      ],
    }) as DailyScheduleProposalV3

    const validation = validateProposalAgainstCurrentPlan(normalized, { date: proposalV3.date, timezone: proposalV3.timezone, planTasks: ['Deep work'] })

    expect(validation.success).toBe(true)
    expect(normalized.blocks[0]).toMatchObject({ taskText: 'Deep work' })
    expect(DailyScheduleSchema.safeParse(proposalToDailySchedule(normalized, { currentPlanTaskCount: 1 })).success).toBe(true)
  })

  it('normalizes v3 day range invariants from planningStartMinutes and activityEndMinutes', () => {
    const normalized = normalizeDailyScheduleProposalToolInput({
      ...proposalV3,
      dayStartMinutes: 8 * 60,
      dayEndMinutes: 22 * 60,
      planningStartMinutes: 9 * 60,
      activityEndMinutes: 19 * 60,
    }) as DailyScheduleProposalV3

    expect(normalized.dayStartMinutes).toBe(normalized.planningStartMinutes)
    expect(normalized.dayEndMinutes).toBe(normalized.activityEndMinutes)
    expect(validateProposalAgainstCurrentPlan(normalized, { date: proposalV3.date, timezone: proposalV3.timezone, planTasks: ['Deep work'] }).success).toBe(true)
  })

  it('normalizes repeated real-world overlap pairs before validation', () => {
    const realWorldProposal: DailyScheduleProposalV3 = {
      ...proposalV3,
      dayStartMinutes: 8 * 60,
      dayEndMinutes: 22 * 60,
      planningStartMinutes: 9 * 60,
      activityEndMinutes: 21 * 60,
      newTasks: ['Call accountant', 'Book tickets', 'Buy milk'],
      blocks: [
        { kind: 'task', taskSource: 'existing', taskIndex: 1, taskText: 'Deep work', category: 'main', isFixed: false, startMinutes: 9 * 60, durationMinutes: 45 },
        { kind: 'rest', title: 'Break', category: 'rest', isFixed: false, startMinutes: 9 * 60 + 45, durationMinutes: 15 },
        { kind: 'buffer', title: 'Inbox', category: 'buffer', isFixed: false, startMinutes: 10 * 60, durationMinutes: 30 },
        { kind: 'task', taskSource: 'new', taskIndex: 1, taskText: 'Call accountant', category: 'operational', isFixed: false, startMinutes: 10 * 60 + 45, durationMinutes: 45 },
        { kind: 'task', taskSource: 'new', taskIndex: 2, taskText: 'Book tickets', category: 'personal', isFixed: false, startMinutes: 11 * 60 + 15, durationMinutes: 45 },
        { kind: 'meal', title: 'Lunch', category: 'meal', isFixed: true, startMinutes: 13 * 60, durationMinutes: 60 },
        { kind: 'buffer', title: 'Travel', category: 'travel', isFixed: true, startMinutes: 16 * 60, durationMinutes: 30 },
        { kind: 'task', taskSource: 'existing', taskIndex: 2, taskText: 'Review', category: 'main', isFixed: false, startMinutes: 17 * 60, durationMinutes: 60 },
        { kind: 'rest', title: 'Walk', category: 'rest', isFixed: false, startMinutes: 18 * 60, durationMinutes: 30 },
        { kind: 'task', taskSource: 'new', taskIndex: 3, taskText: 'Buy milk', category: 'personal', isFixed: false, startMinutes: 18 * 60 + 15, durationMinutes: 30 },
      ],
    }

    const normalized = normalizeDailyScheduleProposalToolInput(realWorldProposal) as DailyScheduleProposalV3

    expect(normalized.dayStartMinutes).toBe(9 * 60)
    expect(normalized.dayEndMinutes).toBe(21 * 60)
    expect(findScheduleOverlaps(proposalToDailySchedule(normalized, { currentPlanTaskCount: 2 }).blocks)).toEqual([])
    expect(getDailyScheduleProposalNormalizationResult(normalized)).toEqual({ unscheduledBlocks: [] })
    expect(validateProposalAgainstCurrentPlan(normalized, { date: proposalV3.date, timezone: proposalV3.timezone, planTasks: ['Deep work', 'Review'] }).success).toBe(true)
  })

  it('normalizes the 14-block 06:00-24:00 regression case into a valid schedule', () => {
    const planTasks = Array.from({ length: 9 }, (_, index) => `Task ${index + 1}`)
    const regressionProposal: DailyScheduleProposalV3 = {
      version: 3,
      date: '2026-02-28',
      timezone: 'Europe/Moscow',
      dayStartMinutes: 6 * 60,
      dayEndMinutes: 24 * 60,
      planningBasis: 'day_start',
      planningStartMinutes: 6 * 60,
      workEndMinutes: 18 * 60,
      activityEndMinutes: 24 * 60,
      newTasks: [],
      blocks: [
        { kind: 'task', taskSource: 'existing', taskIndex: 1, taskText: 'Task 1', category: 'main', isFixed: false, startMinutes: 6 * 60, durationMinutes: 60 },
        { kind: 'buffer', title: 'Inbox', category: 'buffer', isFixed: false, startMinutes: 6 * 60 + 30, durationMinutes: 30 },
        { kind: 'task', taskSource: 'existing', taskIndex: 2, taskText: 'Task 2', category: 'main', isFixed: false, startMinutes: 7 * 60 + 30, durationMinutes: 90 },
        { kind: 'rest', title: 'Break', category: 'rest', isFixed: false, startMinutes: 8 * 60 + 20, durationMinutes: 30 },
        { kind: 'task', taskSource: 'existing', taskIndex: 3, taskText: 'Task 3', category: 'main', isFixed: false, startMinutes: 8 * 60 + 35, durationMinutes: 60 },
        { kind: 'meal', title: 'Lunch', category: 'meal', isFixed: true, startMinutes: 12 * 60, durationMinutes: 60 },
        { kind: 'task', taskSource: 'existing', taskIndex: 4, taskText: 'Task 4', category: 'operational', isFixed: false, startMinutes: 12 * 60 + 20, durationMinutes: 60 },
        { kind: 'buffer', title: 'Buffer', category: 'buffer', isFixed: false, startMinutes: 14 * 60, durationMinutes: 30 },
        { kind: 'task', taskSource: 'existing', taskIndex: 5, taskText: 'Task 5', category: 'main', isFixed: false, startMinutes: 15 * 60, durationMinutes: 60 },
        { kind: 'task', taskSource: 'existing', taskIndex: 6, taskText: 'Task 6', category: 'main', isFixed: false, startMinutes: 15 * 60 + 30, durationMinutes: 60 },
        { kind: 'task', taskSource: 'existing', taskIndex: 7, taskText: 'Wrong model text', category: 'main', isFixed: false, startMinutes: 23 * 60, durationMinutes: 120 },
        { kind: 'rest', title: 'Late rest', category: 'rest', isFixed: false, startMinutes: 1450, durationMinutes: 30 },
        { kind: 'task', taskSource: 'existing', taskIndex: 8, taskText: 'Task 8', category: 'personal', isFixed: false, startMinutes: 21 * 60 + 40, durationMinutes: 90 },
        { kind: 'task', taskSource: 'existing', taskIndex: 9, taskText: 'Task 9', category: 'main', isFixed: false, startMinutes: 22 * 60 + 30, durationMinutes: 60 },
      ],
    }

    const normalized = normalizeDailyScheduleProposalToolInput(regressionProposal) as DailyScheduleProposalV3
    const validation = validateProposalAgainstCurrentPlan(normalized, { date: regressionProposal.date, timezone: regressionProposal.timezone, planTasks })

    expect(validation.success).toBe(true)
    expect(normalized.blocks).toHaveLength(14)
    expect(normalized.blocks[10]).toMatchObject({ taskIndex: 7, taskText: 'Task 7' })
    const schedule = proposalToDailySchedule(normalized, { currentPlanTaskCount: planTasks.length })
    expect(findScheduleOverlaps(schedule.blocks)).toEqual([])
    expect(schedule.blocks.every(block => block.startMinutes >= 6 * 60 && block.startMinutes + block.durationMinutes <= 24 * 60)).toBe(true)
    expect(DailyScheduleSchema.safeParse(schedule).success).toBe(true)
  })

  it('keeps backward-compatible v1 and v2 proposal parsing', () => {
    expect(DailyScheduleProposalV1Schema.safeParse(proposal).success).toBe(true)
    expect(DailyScheduleProposalV2Schema.safeParse(proposalV2).success).toBe(true)
    expect(DailyScheduleProposalSchema.safeParse(proposal).success).toBe(true)
    expect(DailyScheduleProposalSchema.safeParse(proposalV2).success).toBe(true)
  })

  it('converts proposal v3 new tasks to schedule task indexes after current plan tasks', () => {
    const validation = validateProposalAgainstCurrentPlan(proposalV3, { date: '2026-02-28', timezone: 'Europe/Moscow', planTasks: ['Deep work', 'Review'] })

    expect(validation.success).toBe(true)
    const schedule = proposalToDailyScheduleV3(proposalV3, 2)
    expect(schedule.blocks).toMatchObject([
      { kind: 'task', taskIndex: 1, taskText: 'Deep work' },
      { kind: 'task', taskIndex: 3, taskText: 'Call accountant' },
      { kind: 'task', taskIndex: 4, taskText: 'Book tickets' },
      { kind: 'meal', title: 'Lunch' },
    ])
    expect(proposalToDailySchedule(proposalV3, { currentPlanTaskCount: 2 })).toMatchObject({ version: 3, blocks: [{ taskIndex: 1 }, { taskIndex: 3 }, { taskIndex: 4 }, { kind: 'meal' }] })
  })

  it('validates and converts v3 proposals that contain only new task blocks with empty or completed-only current plan', () => {
    const newOnlyProposal: DailyScheduleProposalV3 = {
      version: 3,
      date: '2026-02-28',
      timezone: 'Europe/Moscow',
      dayStartMinutes: 12 * 60 + 30,
      dayEndMinutes: 18 * 60,
      planningBasis: 'current_time',
      planningStartMinutes: 12 * 60 + 30,
      workEndMinutes: 18 * 60,
      activityEndMinutes: 18 * 60,
      newTasks: ['Тетроникс', 'Зарядка', 'АИОНЛАБ'],
      blocks: [
        { kind: 'task', taskSource: 'new', taskIndex: 1, taskText: 'Тетроникс', category: 'main', isFixed: false, startMinutes: 12 * 60 + 30, durationMinutes: 60 },
        { kind: 'task', taskSource: 'new', taskIndex: 2, taskText: 'Зарядка', category: 'personal', isFixed: false, startMinutes: 13 * 60 + 30, durationMinutes: 60 },
        { kind: 'task', taskSource: 'new', taskIndex: 3, taskText: 'АИОНЛАБ', category: 'main', isFixed: false, startMinutes: 14 * 60 + 30, durationMinutes: 90 },
      ],
    }

    expect(validateProposalAgainstCurrentPlan(newOnlyProposal, { date: '2026-02-28', timezone: 'Europe/Moscow', planTasks: [] }).success).toBe(true)
    expect(validateProposalAgainstCurrentPlan(newOnlyProposal, { date: '2026-02-28', timezone: 'Europe/Moscow', planTasks: ['Подъём в 6 утра', 'Холодный душ'] }).success).toBe(true)
    expect(proposalToDailySchedule(newOnlyProposal, { currentPlanTaskCount: 0 })).toMatchObject({ version: 3, blocks: [{ taskIndex: 1 }, { taskIndex: 2 }, { taskIndex: 3 }] })
    expect(proposalToDailySchedule(newOnlyProposal, { currentPlanTaskCount: 2 })).toMatchObject({ version: 3, blocks: [{ taskIndex: 3 }, { taskIndex: 4 }, { taskIndex: 5 }] })

    const metadata = createProposalMetadata({ date: '2026-02-28', proposal: newOnlyProposal, currentScheduleHash: null, currentScheduleExists: false, currentPlanTaskCount: 2, createdAt: new Date('2026-02-28T10:00:00.000Z') })
    expect(metadata.currentPlanTaskCount).toBe(2)
    expect(safeParseProposalMetadata({ ...metadata, loadSummary: { ...metadata.loadSummary, scheduledMinutes: 1 } })).toMatchObject({
      schemaVersion: 3,
      currentPlanTaskCount: 2,
      loadSummary: { scheduledMinutes: 210 },
    })
  })

  it('creates metadata schemaVersion 3 with optional plan tasks hash and computed load summary', () => {
    const currentPlanTasksHash = hashDailyPlanTasks(['Deep work', 'Review'])
    const metadata = createProposalMetadata({
      date: '2026-02-28',
      proposal: proposalV3,
      currentScheduleHash: null,
      currentScheduleExists: false,
      currentPlanTaskCount: 2,
      currentPlanTasksHash,
      createdAt: new Date('2026-02-28T10:00:00.000Z'),
    })

    expect(metadata.schemaVersion).toBe(3)
    expect(metadata.currentPlanTasksHash).toBe(currentPlanTasksHash)
    expect(metadata.loadSummary.scheduledMinutes).toBe(180)
    expect(safeParseProposalMetadata({ ...metadata, loadSummary: { ...metadata.loadSummary, scheduledMinutes: 1 } })).toMatchObject({
      schemaVersion: 3,
      loadSummary: { scheduledMinutes: 180 },
    })
  })

  it('hashes plan tasks stably and remains sensitive to order and text', () => {
    const hash = hashDailyPlanTasks(['Deep work', 'Review'])

    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hashDailyPlanTasks(['Deep work', 'Review'])).toBe(hash)
    expect(hashDailyPlanTasks(['Review', 'Deep work'])).not.toBe(hash)
    expect(hashDailyPlanTasks(['Deep work', 'Review!'])).not.toBe(hash)
  })
})
