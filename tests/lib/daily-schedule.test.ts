import { afterEach, describe, expect, it, vi } from 'vitest'
import { DailySchedule, DailyScheduleSchema, blocksOverlap, computeDailyScheduleLoadSummary, findScheduleOverlaps, hashDailySchedule, isDailyScheduleV2, isDailyScheduleV3, isServiceBlock } from '@/lib/daily-schedule'

afterEach(() => {
  vi.unstubAllEnvs()
})

const validSchedule: DailySchedule = {
  version: 1,
  timezone: 'Europe/Moscow',
  dayStartMinutes: 8 * 60,
  dayEndMinutes: 18 * 60,
  blocks: [
    {
      id: 'task-1',
      taskIndex: 1,
      taskText: 'Deep work',
      startMinutes: 9 * 60,
      durationMinutes: 60,
    },
    {
      id: 'task-2',
      taskIndex: 2,
      taskText: 'Planning',
      startMinutes: 10 * 60,
      durationMinutes: 30,
    },
  ],
}

describe('DailyScheduleSchema', () => {
  it('accepts valid payload', () => {
    expect(DailyScheduleSchema.safeParse(validSchedule).success).toBe(true)
  })

  it('accepts v2 task and service blocks', () => {
    const schedule: DailySchedule = {
      version: 2,
      timezone: 'Europe/Moscow',
      dayStartMinutes: 8 * 60,
      dayEndMinutes: 18 * 60,
      blocks: [
        { id: 'task-1', kind: 'task', taskIndex: 1, taskText: 'Deep work', startMinutes: 9 * 60, durationMinutes: 60 },
        { id: 'meal-1', kind: 'meal', title: 'Lunch', startMinutes: 12 * 60, durationMinutes: 30 },
      ],
    }

    const result = DailyScheduleSchema.safeParse(schedule)

    expect(result.success).toBe(true)
    expect(isDailyScheduleV2(schedule)).toBe(true)
    expect(isServiceBlock(schedule.blocks[1])).toBe(true)
  })

  it('accepts day boundary values', () => {
    const result = DailyScheduleSchema.safeParse({
      ...validSchedule,
      dayStartMinutes: 0,
      dayEndMinutes: 1440,
      blocks: [{ ...validSchedule.blocks[0], startMinutes: 0, durationMinutes: 15 }],
    })

    expect(result.success).toBe(true)
  })

  it('accepts v3 planning fields, categories and fixed blocks', () => {
    const schedule: DailySchedule = {
      version: 3,
      timezone: 'Europe/Moscow',
      dayStartMinutes: 9 * 60 + 30,
      dayEndMinutes: 21 * 60 + 30,
      planningBasis: 'current_time',
      planningStartMinutes: 9 * 60 + 30,
      workEndMinutes: 18 * 60,
      activityEndMinutes: 21 * 60 + 30,
      blocks: [
        { id: 'main-1', kind: 'task', taskIndex: 1, taskText: 'Deep work', category: 'main', isFixed: false, startMinutes: 10 * 60, durationMinutes: 45 },
        { id: 'personal-1', kind: 'buffer', title: 'Family', category: 'personal', isFixed: true, startMinutes: 18 * 60, durationMinutes: 120 },
      ],
    }

    const result = DailyScheduleSchema.safeParse(schedule)

    expect(result.success).toBe(true)
    expect(isDailyScheduleV3(schedule)).toBe(true)
    expect(isServiceBlock(schedule.blocks[1])).toBe(true)
  })

  it('rejects v3 non 15-minute planning fields and inconsistent planning order', () => {
    const result = DailyScheduleSchema.safeParse({
      version: 3,
      timezone: 'Europe/Moscow',
      dayStartMinutes: 9 * 60 + 30,
      dayEndMinutes: 21 * 60 + 30,
      planningBasis: 'custom_time',
      planningStartMinutes: 9 * 60 + 31,
      workEndMinutes: 9 * 60 + 15,
      activityEndMinutes: 21 * 60 + 30,
      blocks: [],
    })

    expect(result.success).toBe(false)
  })

  it('rejects v3 dayStart/dayEnd when they are not aligned with planning interval', () => {
    const result = DailyScheduleSchema.safeParse({
      version: 3,
      timezone: 'Europe/Moscow',
      dayStartMinutes: 9 * 60,
      dayEndMinutes: 21 * 60 + 30,
      planningBasis: 'current_time',
      planningStartMinutes: 9 * 60 + 30,
      workEndMinutes: 18 * 60,
      activityEndMinutes: 21 * 60 + 30,
      blocks: [],
    })

    expect(result.success).toBe(false)
  })

  it('rejects non 15-minute start and duration steps', () => {
    const result = DailyScheduleSchema.safeParse({
      ...validSchedule,
      blocks: [{ ...validSchedule.blocks[0], startMinutes: 541, durationMinutes: 20 }],
    })

    expect(result.success).toBe(false)
  })

  it('rejects block outside day range', () => {
    const result = DailyScheduleSchema.safeParse({
      ...validSchedule,
      dayStartMinutes: 9 * 60,
      dayEndMinutes: 10 * 60,
      blocks: [{ ...validSchedule.blocks[0], startMinutes: 9 * 60 + 45, durationMinutes: 30 }],
    })

    expect(result.success).toBe(false)
  })

  it('rejects overlapping blocks', () => {
    const overlapping = {
      ...validSchedule,
      blocks: [
        { ...validSchedule.blocks[0], id: 'a', startMinutes: 9 * 60, durationMinutes: 60 },
        { ...validSchedule.blocks[1], id: 'b', startMinutes: 9 * 60 + 30, durationMinutes: 30 },
      ],
    }

    expect(DailyScheduleSchema.safeParse(overlapping).success).toBe(false)
    expect(findScheduleOverlaps(overlapping.blocks)).toEqual([{ firstId: 'a', secondId: 'b' }])
  })

  it('rejects more than 100 blocks', () => {
    const blocks = Array.from({ length: 101 }, (_, index) => ({
      id: `block-${index}`,
      taskIndex: index + 1,
      taskText: `Task ${index}`,
      startMinutes: index * 15,
      durationMinutes: 15,
    }))

    expect(DailyScheduleSchema.safeParse({ ...validSchedule, dayStartMinutes: 0, dayEndMinutes: 1440, blocks }).success).toBe(false)
  })
})

describe('daily schedule helpers', () => {
  it('detects overlaps and treats touching blocks as non-overlapping', () => {
    expect(blocksOverlap({ startMinutes: 60, durationMinutes: 30 }, { startMinutes: 89, durationMinutes: 15 })).toBe(true)
    expect(blocksOverlap({ startMinutes: 60, durationMinutes: 30 }, { startMinutes: 90, durationMinutes: 15 })).toBe(false)
  })

  it('hashes normalized schedule deterministically', () => {
    const reversed = { ...validSchedule, blocks: [...validSchedule.blocks].reverse() }

    expect(hashDailySchedule(validSchedule)).toBe(hashDailySchedule(reversed))
  })

  it('does not change legacy v1 hashes when v3 support is added', () => {
    expect(hashDailySchedule(validSchedule)).toBe('90c46cd687027b6d8f075fcdf5c88ddcf4662768a5d019ff01212facbb62294a')
  })

  it('computes active-interval summary without double count for 09:30-21:30 day', () => {
    const schedule: DailySchedule = {
      version: 3,
      timezone: 'Europe/Moscow',
      dayStartMinutes: 9 * 60 + 30,
      dayEndMinutes: 21 * 60 + 30,
      planningBasis: 'current_time',
      planningStartMinutes: 9 * 60 + 30,
      workEndMinutes: 18 * 60,
      activityEndMinutes: 21 * 60 + 30,
      blocks: [
        { id: 'main-1', kind: 'task', taskIndex: 1, taskText: 'Deep work 1', category: 'main', isFixed: false, startMinutes: 10 * 60, durationMinutes: 45 },
        { id: 'main-2', kind: 'task', taskIndex: 2, taskText: 'Deep work 2', category: 'main', isFixed: false, startMinutes: 11 * 60, durationMinutes: 90 },
        { id: 'personal-1', kind: 'buffer', title: 'Personal', category: 'personal', isFixed: true, startMinutes: 18 * 60, durationMinutes: 120 },
        { id: 'travel-1', kind: 'buffer', title: 'Travel', category: 'travel', isFixed: true, startMinutes: 20 * 60, durationMinutes: 90 },
      ],
    }

    const summary = computeDailyScheduleLoadSummary(schedule)

    expect(summary.activeInterval).toEqual({ startMinutes: 570, endMinutes: 1290, availableMinutes: 720 })
    expect(summary.workInterval).toEqual({ startMinutes: 570, endMinutes: 1080, availableMinutes: 510 })
    expect(summary.scheduledMinutes).toBe(345)
    expect(summary.unscheduledMinutes).toBe(375)
    expect(summary.scheduledPercent).toBe(47.92)
    expect(summary.unscheduledPercent).toBe(52.08)
    expect(summary.workScheduledMinutes).toBe(135)
    expect(summary.workScheduledPercent).toBe(26.47)
    expect(summary.categories.main).toMatchObject({ minutes: 135, percent: 18.75, workMinutes: 135, workPercent: 26.47 })
    expect(summary.categories.personal).toMatchObject({ minutes: 120, percent: 16.67, workMinutes: 0, workPercent: 0 })
    expect(summary.categories.travel).toMatchObject({ minutes: 90, percent: 12.5, workMinutes: 0, workPercent: 0 })
    expect(summary.loadLevel).toBe('balanced')
  })
})
