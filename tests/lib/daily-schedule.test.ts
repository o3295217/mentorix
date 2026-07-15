import { afterEach, describe, expect, it, vi } from 'vitest'
import { DailySchedule, DailyScheduleSchema, blocksOverlap, findScheduleOverlaps, hashDailySchedule, isDailyScheduleV2, isServiceBlock } from '@/lib/daily-schedule'

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
})
