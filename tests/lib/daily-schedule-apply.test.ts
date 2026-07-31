import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hashDailySchedule } from '@/lib/daily-schedule'
import { createProposalMetadata, createTaskListProposalMetadata, hashDailyPlanTasks, proposalToDailySchedule, proposalToDailyScheduleV3, type DailyScheduleProposalV2, type DailyScheduleProposalV3 } from '@/lib/daily-schedule-proposal'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  dailyEntryFindFirst: vi.fn(),
  dailyEntryUpdate: vi.fn(),
  chatMessageFindFirst: vi.fn(),
  chatMessageUpdate: vi.fn(),
  dailyScheduleUpsert: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: mocks.transaction },
}))

import { applyDailyScheduleProposal, applyDailyTaskListProposal } from '@/lib/daily-schedule-apply'

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

const proposalV2: DailyScheduleProposalV2 = {
  version: 2,
  date: '2026-02-28',
  timezone: 'Europe/Moscow',
  dayStartMinutes: 9 * 60,
  dayEndMinutes: 18 * 60,
  planningBasis: 'day_start',
  planningStartMinutes: 9 * 60,
  workEndMinutes: 17 * 60,
  activityEndMinutes: 18 * 60,
  blocks: [
    { kind: 'task', taskIndex: 1, taskText: 'Deep work', category: 'main', isFixed: false, startMinutes: 9 * 60, durationMinutes: 60 },
    { kind: 'task', taskIndex: 2, taskText: 'Review', category: 'operational', isFixed: false, startMinutes: 10 * 60 + 15, durationMinutes: 45 },
  ],
}

function txObject() {
  return {
    $queryRaw: mocks.queryRaw,
    dailyEntry: { findFirst: mocks.dailyEntryFindFirst, update: mocks.dailyEntryUpdate },
    chatMessage: { findFirst: mocks.chatMessageFindFirst, update: mocks.chatMessageUpdate },
    dailySchedule: { upsert: mocks.dailyScheduleUpsert },
  }
}

function setupTransaction() {
  mocks.transaction.mockImplementation((fn: (tx: ReturnType<typeof txObject>) => unknown) => fn(txObject()))
}

function setupEntry(planText: string, schedule: { scheduleJson: unknown; updatedAt: Date } | null = null) {
  mocks.dailyEntryFindFirst
    .mockResolvedValueOnce({ id: 42 })
    .mockResolvedValueOnce({ id: 42, planText, schedule })
}

function applyInput(expectedCurrentScheduleHash: string | null = null) {
  return {
    userId: 'user-1',
    date: '2026-02-28',
    messageId: 12,
    replaceExisting: expectedCurrentScheduleHash !== null,
    expectedCurrentScheduleHash,
  }
}

beforeEach(() => {
  setupTransaction()
  mocks.queryRaw.mockResolvedValue([])
  mocks.dailyEntryUpdate.mockResolvedValue({ id: 42 })
  mocks.chatMessageUpdate.mockResolvedValue({ id: 12 })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('applyDailyScheduleProposal', () => {
  it('applies proposal v3 with new tasks by appending planText and remapping final task indexes atomically', async () => {
    const currentPlanTasks = ['Deep work', 'Review']
    const metadata = createProposalMetadata({
      date: '2026-02-28',
      proposal: proposalV3,
      currentScheduleHash: null,
      currentScheduleExists: false,
      currentPlanTaskCount: currentPlanTasks.length,
      currentPlanTasksHash: hashDailyPlanTasks(currentPlanTasks),
      createdAt: new Date('2026-02-28T10:00:00.000Z'),
    })
    const schedule = proposalToDailySchedule(proposalV3, { currentPlanTaskCount: currentPlanTasks.length })
    mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: metadata })
    setupEntry(currentPlanTasks.join('\n'))
    mocks.dailyScheduleUpsert.mockResolvedValue({ scheduleJson: schedule, updatedAt: new Date('2026-02-28T11:00:00.000Z') })

    const result = await applyDailyScheduleProposal(applyInput())

    expect(result).toMatchObject({ status: 200, applyStatus: 'created', planTasks: ['Deep work', 'Review', 'Call accountant', 'Book tickets'] })
    expect(mocks.dailyEntryUpdate).toHaveBeenCalledWith({ where: { id: 42 }, data: { planText: 'Deep work\nReview\nCall accountant\nBook tickets' }, select: { id: true } })
    expect(mocks.dailyScheduleUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { dailyEntryId: 42, scheduleJson: schedule },
      update: { scheduleJson: schedule },
    }))
    expect(schedule.blocks).toMatchObject([
      { kind: 'task', taskIndex: 1, taskText: 'Deep work' },
      { kind: 'task', taskIndex: 3, taskText: 'Call accountant' },
      { kind: 'task', taskIndex: 4, taskText: 'Book tickets' },
      { kind: 'meal' },
    ])
  })

  it('applies v3 new task without a schedule block by appending it to planText only', async () => {
    const currentPlanTasks = ['Deep work', 'Review']
    const unscheduledNewTaskProposal: DailyScheduleProposalV3 = {
      ...proposalV3,
      newTasks: ['Call accountant', 'Book tickets', 'Buy milk'],
      blocks: proposalV3.blocks.filter(block => !(block.kind === 'task' && block.taskSource === 'new' && block.taskIndex === 2)),
    }
    const metadata = createProposalMetadata({
      date: '2026-02-28',
      proposal: unscheduledNewTaskProposal,
      currentScheduleHash: null,
      currentScheduleExists: false,
      currentPlanTaskCount: currentPlanTasks.length,
      currentPlanTasksHash: hashDailyPlanTasks(currentPlanTasks),
    })
    const schedule = proposalToDailySchedule(unscheduledNewTaskProposal, { currentPlanTaskCount: currentPlanTasks.length })
    mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: metadata })
    setupEntry(currentPlanTasks.join('\n'))
    mocks.dailyScheduleUpsert.mockResolvedValue({ scheduleJson: schedule, updatedAt: new Date('2026-02-28T11:00:00.000Z') })

    const result = await applyDailyScheduleProposal(applyInput())

    expect(result).toMatchObject({ status: 200, planTasks: ['Deep work', 'Review', 'Call accountant', 'Book tickets', 'Buy milk'] })
    expect(mocks.dailyEntryUpdate).toHaveBeenCalledWith({ where: { id: 42 }, data: { planText: 'Deep work\nReview\nCall accountant\nBook tickets\nBuy milk' }, select: { id: true } })
    expect(schedule.blocks).toEqual(expect.not.arrayContaining([expect.objectContaining({ taskText: 'Book tickets' })]))
    expect(schedule.blocks).toEqual(expect.not.arrayContaining([expect.objectContaining({ taskText: 'Buy milk' })]))
    expect(mocks.dailyScheduleUpsert).toHaveBeenCalledWith(expect.objectContaining({ create: { dailyEntryId: 42, scheduleJson: schedule } }))
  })

  it('rejects proposal v3 when currentPlanTasksHash no longer matches current entry tasks', async () => {
    const metadata = createProposalMetadata({
      date: '2026-02-28',
      proposal: proposalV3,
      currentScheduleHash: null,
      currentScheduleExists: false,
      currentPlanTaskCount: 2,
      currentPlanTasksHash: hashDailyPlanTasks(['Deep work', 'Review']),
    })
    mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: metadata })
    setupEntry('Deep work\nChanged review')

    const result = await applyDailyScheduleProposal(applyInput())

    expect(result).toEqual({ status: 409, currentHash: null, error: 'Список задач изменился после создания предложения. Попросите AI обновить расписание.' })
    expect(mocks.dailyEntryUpdate).not.toHaveBeenCalled()
    expect(mocks.dailyScheduleUpsert).not.toHaveBeenCalled()
  })

  it('returns already_applied for repeated v3 apply without duplicating new tasks', async () => {
    const basePlanTasks = ['Deep work', 'Review']
    const appliedPlanTasks = [...basePlanTasks, 'Call accountant', 'Book tickets']
    const schedule = proposalToDailySchedule(proposalV3, { currentPlanTaskCount: basePlanTasks.length })
    const metadata = {
      ...createProposalMetadata({
        date: '2026-02-28',
        proposal: proposalV3,
        currentScheduleHash: null,
        currentScheduleExists: false,
        currentPlanTaskCount: basePlanTasks.length,
        currentPlanTasksHash: hashDailyPlanTasks(basePlanTasks),
      }),
      appliedAt: '2026-02-28T11:00:00.000Z',
    }
    mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: metadata })
    setupEntry(appliedPlanTasks.join('\n'), { scheduleJson: schedule, updatedAt: new Date('2026-02-28T11:00:00.000Z') })

    const result = await applyDailyScheduleProposal(applyInput())

    expect(result).toMatchObject({ status: 200, applyStatus: 'already_applied', planTasks: appliedPlanTasks })
    expect(mocks.dailyEntryUpdate).not.toHaveBeenCalled()
    expect(mocks.dailyScheduleUpsert).not.toHaveBeenCalled()
  })

  it('keeps v2 proposals backward-compatible and does not change planText', async () => {
    const metadata = createProposalMetadata({ date: '2026-02-28', proposal: proposalV2, currentScheduleHash: null, currentScheduleExists: false })
    const schedule = proposalToDailyScheduleV3(proposalV2)
    mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: metadata })
    setupEntry('Deep work\nReview')
    mocks.dailyScheduleUpsert.mockResolvedValue({ scheduleJson: schedule, updatedAt: new Date('2026-02-28T11:00:00.000Z') })

    const result = await applyDailyScheduleProposal(applyInput())

    expect(result).toMatchObject({ status: 200, planTasks: ['Deep work', 'Review'] })
    expect(mocks.dailyEntryUpdate).not.toHaveBeenCalled()
    expect(mocks.dailyScheduleUpsert).toHaveBeenCalledOnce()
  })

  it('rejects v3 new tasks that duplicate existing plan tasks textually', async () => {
    const duplicateProposal: DailyScheduleProposalV3 = {
      ...proposalV3,
      newTasks: ['Review'],
      blocks: [
        proposalV3.blocks[0],
        { kind: 'task', taskSource: 'new', taskIndex: 1, taskText: 'Review', category: 'operational', isFixed: false, startMinutes: 10 * 60 + 15, durationMinutes: 30 },
      ],
    }
    const planTasks = ['Deep work', 'review']
    const metadata = createProposalMetadata({
      date: '2026-02-28',
      proposal: duplicateProposal,
      currentScheduleHash: null,
      currentScheduleExists: false,
      currentPlanTaskCount: planTasks.length,
      currentPlanTasksHash: hashDailyPlanTasks(planTasks),
    })
    mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: metadata })
    setupEntry(planTasks.join('\n'))

    const result = await applyDailyScheduleProposal(applyInput())

    expect(result).toEqual({ status: 409, currentHash: null, error: 'Новая задача уже есть в текущем плане: Review' })
    expect(mocks.dailyEntryUpdate).not.toHaveBeenCalled()
    expect(mocks.dailyScheduleUpsert).not.toHaveBeenCalled()
  })

  it('keeps planText update and schedule upsert in one transaction path', async () => {
    const currentPlanTasks = ['Deep work', 'Review']
    const metadata = createProposalMetadata({
      date: '2026-02-28',
      proposal: proposalV3,
      currentScheduleHash: null,
      currentScheduleExists: false,
      currentPlanTaskCount: currentPlanTasks.length,
      currentPlanTasksHash: hashDailyPlanTasks(currentPlanTasks),
    })
    mocks.transaction.mockImplementation(async (fn: (tx: ReturnType<typeof txObject>) => unknown) => {
      try {
        return await fn(txObject())
      } catch (error) {
        throw error
      }
    })
    mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: metadata })
    setupEntry(currentPlanTasks.join('\n'))
    mocks.dailyScheduleUpsert.mockResolvedValue({ scheduleJson: { version: 999 }, updatedAt: new Date('2026-02-28T11:00:00.000Z') })

    const result = await applyDailyScheduleProposal(applyInput())

    expect(result).toEqual({ status: 409, currentHash: null, error: 'Persisted schedule is invalid' })
    expect(mocks.transaction).toHaveBeenCalledOnce()
    expect(mocks.dailyEntryUpdate).toHaveBeenCalledOnce()
    expect(mocks.dailyScheduleUpsert).toHaveBeenCalledOnce()
    expect(mocks.chatMessageUpdate).not.toHaveBeenCalled()
  })
})

describe('applyDailyTaskListProposal', () => {
  it('appends task-list proposal to planText without touching DailySchedule', async () => {
    const currentPlanTasks: string[] = []
    const metadata = createTaskListProposalMetadata({
      date: '2026-02-28',
      tasks: ['Тетроникс', 'Зарядка', 'АИОНЛАБ'],
      currentPlanTaskCount: 0,
      currentPlanTasksHash: hashDailyPlanTasks(currentPlanTasks),
      scheduleIssue: { reason: 'в расписании есть пересекающиеся блоки.', diagnostics: ['blocks 1 and 2 overlap'], nextAction: null },
    })
    mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: metadata })
    setupEntry('', { scheduleJson: { version: 3, timezone: 'Europe/Moscow', dayStartMinutes: 540, dayEndMinutes: 1080, planningBasis: 'day_start', planningStartMinutes: 540, workEndMinutes: 1080, activityEndMinutes: 1080, blocks: [] }, updatedAt: new Date('2026-02-28T09:00:00.000Z') })
    mocks.dailyEntryUpdate.mockResolvedValue({ planText: 'Тетроникс\nЗарядка\nАИОНЛАБ', updatedAt: new Date('2026-02-28T11:00:00.000Z') })

    const result = await applyDailyTaskListProposal({ userId: 'user-1', date: '2026-02-28', messageId: 12, expectedCurrentPlanTasksHash: hashDailyPlanTasks(currentPlanTasks) })

    expect(result).toMatchObject({ status: 200, applyStatus: 'created', planText: 'Тетроникс\nЗарядка\nАИОНЛАБ', planTasks: ['Тетроникс', 'Зарядка', 'АИОНЛАБ'] })
    expect(mocks.dailyEntryUpdate).toHaveBeenCalledWith({ where: { id: 42 }, data: { planText: 'Тетроникс\nЗарядка\nАИОНЛАБ' }, select: { planText: true, updatedAt: true } })
    expect(mocks.dailyScheduleUpsert).not.toHaveBeenCalled()
  })

  it('is idempotent for repeated task-list apply and does not duplicate tasks', async () => {
    const basePlanTasks: string[] = []
    const tasks = ['Тетроникс', 'Зарядка']
    const metadata = { ...createTaskListProposalMetadata({ date: '2026-02-28', tasks, currentPlanTaskCount: 0, currentPlanTasksHash: hashDailyPlanTasks(basePlanTasks) }), appliedAt: '2026-02-28T11:00:00.000Z' }
    mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: metadata })
    setupEntry(tasks.join('\n'))

    const result = await applyDailyTaskListProposal({ userId: 'user-1', date: '2026-02-28', messageId: 12, expectedCurrentPlanTasksHash: hashDailyPlanTasks(basePlanTasks) })

    expect(result).toMatchObject({ status: 200, applyStatus: 'already_applied', planTasks: tasks })
    expect(mocks.dailyEntryUpdate).not.toHaveBeenCalled()
    expect(mocks.dailyScheduleUpsert).not.toHaveBeenCalled()
  })
})
