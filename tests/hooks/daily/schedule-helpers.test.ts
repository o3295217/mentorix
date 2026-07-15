import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DAY_END_MINUTES,
  DEFAULT_DAY_START_MINUTES,
  type BlockInput,
  autoLayoutBlocks,
  buildSchedule,
  clamp,
  clampBlockToRange,
  computeUnscheduledTaskIndexes,
  findFreeSlot,
  formatDurationLabel,
  getPendingSaveDateChangeAction,
  getBlockEnd,
  hasOverlapWithOthers,
  isScheduleRequestCurrent,
  isBlockInRange,
  isTaskScheduleBlock,
  minutesToTimeInputValue,
  minutesToTimeLabel,
  reconcileSchedule,
  scheduleEquals,
  snapDownToStep,
  snapToStep,
  timeLabelToMinutes,
} from '@/hooks/daily/schedule-helpers'

const onlyTaskBlocks = (blocks: BlockInput[]) => blocks.filter(isTaskScheduleBlock)

const DAY_START = 6 * 60
const DAY_END = 24 * 60
const seqGen = () => {
  let i = 0
  return () => `b-${++i}`
}

describe('schedule-helpers · time & numeric primitives', () => {
  it('snaps to 15-minute step (round and floor)', () => {
    expect(snapToStep(7)).toBe(0)
    expect(snapToStep(8)).toBe(15)
    expect(snapToStep(22)).toBe(15)
    expect(snapToStep(23)).toBe(30)
    expect(snapDownToStep(29)).toBe(15)
    expect(snapDownToStep(30)).toBe(30)
  })

  it('clamps within range', () => {
    expect(clamp(5, 10, 20)).toBe(10)
    expect(clamp(25, 10, 20)).toBe(20)
    expect(clamp(15, 10, 20)).toBe(15)
  })

  it('formats minutes as HH:MM, including 24:00', () => {
    expect(minutesToTimeLabel(0)).toBe('00:00')
    expect(minutesToTimeLabel(6 * 60)).toBe('06:00')
    expect(minutesToTimeLabel(1440)).toBe('24:00')
    expect(minutesToTimeLabel(12 * 60 + 30)).toBe('12:30')
  })

  it('parses HH:MM back to minutes', () => {
    expect(timeLabelToMinutes('06:00')).toBe(360)
    expect(timeLabelToMinutes('24:00')).toBe(1440)
    expect(timeLabelToMinutes('23:30')).toBe(1410)
    expect(timeLabelToMinutes('25:00')).toBe(-1)
    expect(timeLabelToMinutes('12:60')).toBe(-1)
    expect(timeLabelToMinutes('bad')).toBe(-1)
  })

  it('caps time input value at 23:59 for <input type="time">', () => {
    expect(minutesToTimeInputValue(1440)).toBe('23:59')
    expect(minutesToTimeInputValue(360)).toBe('06:00')
  })

  it('formats human-readable duration', () => {
    expect(formatDurationLabel(60)).toBe('1 ч')
    expect(formatDurationLabel(90)).toBe('1 ч 30 мин')
    expect(formatDurationLabel(15)).toBe('15 мин')
  })
})

describe('schedule-helpers · geometry', () => {
  it('detects overlap and treats touching as non-overlap', () => {
    const a = { startMinutes: 60, durationMinutes: 30 }
    expect(hasOverlapWithOthers(a, [{ id: 'x', taskIndex: 1, taskText: 'x', startMinutes: 89, durationMinutes: 15 }])).toBe(true)
    expect(hasOverlapWithOthers(a, [{ id: 'x', taskIndex: 1, taskText: 'x', startMinutes: 90, durationMinutes: 15 }])).toBe(false)
  })

  it('ignores self by id', () => {
    const block = { id: 'a', taskIndex: 1, taskText: 'x', startMinutes: 60, durationMinutes: 30 }
    expect(hasOverlapWithOthers(block, [block], 'a')).toBe(false)
  })

  it('checks range membership', () => {
    expect(isBlockInRange({ startMinutes: 360, durationMinutes: 60 }, 360, 1440)).toBe(true)
    expect(isBlockInRange({ startMinutes: 1400, durationMinutes: 60 }, 360, 1440)).toBe(false)
  })

  it('clamps block to range with 15-min step', () => {
    const r = clampBlockToRange({ startMinutes: 350, durationMinutes: 22 }, 360, 1440)
    expect(r).toEqual({ startMinutes: 360, durationMinutes: 15 })

    const r2 = clampBlockToRange({ startMinutes: 1500, durationMinutes: 60 }, 360, 1440)
    // duration is clamped to span, then start clamped so end <= 1440
    expect(r2.startMinutes + r2.durationMinutes).toBeLessThanOrEqual(1440)
    expect(r2.startMinutes).toBeGreaterThanOrEqual(360)
  })
})

describe('schedule-helpers · autoLayoutBlocks', () => {
  it('places tasks with default 60-min duration and gaps when there is room', () => {
    const { blocks, unscheduledIndexes } = autoLayoutBlocks(
      [{ taskText: 'A' }, { taskText: 'B' }, { taskText: 'C' }],
      DAY_START,
      DAY_END,
      { generateId: seqGen() },
    )
    expect(blocks).toHaveLength(3)
    expect(unscheduledIndexes).toEqual([])
    expect(blocks.map(b => b.startMinutes)).toEqual([360, 435, 510])
    expect(blocks.map(b => b.durationMinutes)).toEqual([60, 60, 60])
    expect(onlyTaskBlocks(blocks).map(b => b.taskIndex)).toEqual([1, 2, 3])
    expect(onlyTaskBlocks(blocks).map(b => b.taskText)).toEqual(['A', 'B', 'C'])
  })

  it('drops gaps first when tight', () => {
    // 5 tasks at 60 min = 300; span 300 → fits with no gap
    const { blocks } = autoLayoutBlocks(
      Array.from({ length: 5 }, (_, i) => ({ taskText: `T${i}` })),
      600,
      900,
      { generateId: seqGen() },
    )
    expect(blocks).toHaveLength(5)
    expect(blocks.every(b => b.durationMinutes === 60)).toBe(true)
    expect(blocks.map(b => b.startMinutes)).toEqual([600, 660, 720, 780, 840])
  })

  it('shrinks duration to fit before dropping tasks', () => {
    // 10 tasks, span = 540 min. 10*60=600 > 540 → duration shrinks to floor(540/10)=54
    const { blocks, unscheduledIndexes } = autoLayoutBlocks(
      Array.from({ length: 10 }, (_, i) => ({ taskText: `T${i}` })),
      600,
      1140,
      { generateId: seqGen() },
    )
    expect(blocks).toHaveLength(10)
    expect(unscheduledIndexes).toEqual([])
    expect(blocks.every(b => b.durationMinutes === 45)).toBe(true) // floor(540/10)=54 → snapped down to 45
    expect(blocks[blocks.length - 1].startMinutes + blocks[blocks.length - 1].durationMinutes).toBeLessThanOrEqual(1140)
  })

  it('overflows tasks that cannot fit even at 15-min minimum', () => {
    // span = 60 min → only 4 tasks of 15 min fit
    const { blocks, unscheduledIndexes } = autoLayoutBlocks(
      Array.from({ length: 6 }, (_, i) => ({ taskText: `T${i}` })),
      600,
      660,
      { generateId: seqGen() },
    )
    expect(blocks).toHaveLength(4)
    expect(unscheduledIndexes).toEqual([4, 5])
    expect(blocks.every(b => b.durationMinutes === 15)).toBe(true)
  })

  it('returns empty blocks when there are no tasks', () => {
    expect(autoLayoutBlocks([], DAY_START, DAY_END)).toEqual({ blocks: [], unscheduledIndexes: [] })
  })

  it('returns empty blocks when span is too small', () => {
    const { blocks, unscheduledIndexes } = autoLayoutBlocks(
      [{ taskText: 'A' }],
      600,
      610,
    )
    expect(blocks).toEqual([])
    expect(unscheduledIndexes).toEqual([0])
  })

  it('trims task text', () => {
    const { blocks } = autoLayoutBlocks([{ taskText: '  spaced  ' }], DAY_START, DAY_END, { generateId: seqGen() })
    expect(isTaskScheduleBlock(blocks[0]) ? blocks[0].taskText : '').toBe('spaced')
  })

  it('respects MAX_BLOCKS cap', () => {
    // span = full day (1440) → 96 tasks of 15 min fit numerically, but MAX_BLOCKS=100. Use 101 tasks.
    const tasks = Array.from({ length: 101 }, (_, i) => ({ taskText: `T${i}` }))
    const { blocks, unscheduledIndexes } = autoLayoutBlocks(tasks, 0, 1440, { generateId: seqGen() })
    expect(blocks.length).toBeLessThanOrEqual(100)
    expect(unscheduledIndexes.length).toBeGreaterThan(0)
  })
})

describe('schedule-helpers · reconcileSchedule', () => {
  const baseBlocks = (gen: () => string): BlockInput[] => [
    { id: gen(), taskIndex: 1, taskText: 'A', startMinutes: 360, durationMinutes: 60 },
    { id: gen(), taskIndex: 2, taskText: 'B', startMinutes: 480, durationMinutes: 60 },
    { id: gen(), taskIndex: 3, taskText: 'C', startMinutes: 600, durationMinutes: 60 },
  ]

  it('preserves ids and times on no-op', () => {
    const gen = seqGen()
    const blocks = baseBlocks(gen)
    const tasks = [{ taskText: 'A' }, { taskText: 'B' }, { taskText: 'C' }]
    const result = reconcileSchedule(blocks, tasks, tasks)
    expect(result.blocks).toEqual(blocks)
    expect(result.removedBlockIds).toEqual([])
  })

  it('keeps ids and times when reordering tasks', () => {
    const gen = seqGen()
    const blocks = baseBlocks(gen)
    const prev = [{ taskText: 'A' }, { taskText: 'B' }, { taskText: 'C' }]
    const next = [{ taskText: 'C' }, { taskText: 'B' }, { taskText: 'A' }]
    const result = reconcileSchedule(blocks, prev, next)

    // Blocks keep their time slot and id; taskIndex is reassigned to the new
    // position of the matching (text + occurrence) task.
    expect(result.blocks.map(b => b.id)).toEqual(blocks.map(b => b.id))
    expect(onlyTaskBlocks(result.blocks).map(b => b.taskText)).toEqual(['A', 'B', 'C'])
    expect(onlyTaskBlocks(result.blocks).map(b => b.taskIndex)).toEqual([3, 2, 1])
    // times preserved
    expect(result.blocks[0].startMinutes).toBe(360)
    expect(result.blocks[2].startMinutes).toBe(600)
    expect(result.removedBlockIds).toEqual([])
  })

  it('removes blocks for deleted tasks', () => {
    const gen = seqGen()
    const blocks = baseBlocks(gen)
    const prev = [{ taskText: 'A' }, { taskText: 'B' }, { taskText: 'C' }]
    const next = [{ taskText: 'A' }, { taskText: 'C' }]
    const result = reconcileSchedule(blocks, prev, next)

    expect(result.blocks).toHaveLength(2)
    expect(onlyTaskBlocks(result.blocks).map(b => b.taskText)).toEqual(['A', 'C'])
    expect(onlyTaskBlocks(result.blocks).map(b => b.taskIndex)).toEqual([1, 2])
    expect(result.removedBlockIds).toEqual([blocks[1].id])
  })

  it('handles edited task text (becomes unscheduled, block removed)', () => {
    const gen = seqGen()
    const blocks = baseBlocks(gen)
    const prev = [{ taskText: 'A' }, { taskText: 'B' }, { taskText: 'C' }]
    const next = [{ taskText: 'A' }, { taskText: 'B2' }, { taskText: 'C' }]
    const result = reconcileSchedule(blocks, prev, next)

    expect(onlyTaskBlocks(result.blocks).map(b => b.taskText)).toEqual(['A', 'C'])
    expect(result.removedBlockIds).toEqual([blocks[1].id])
    // New "B2" should be unscheduled
    expect(computeUnscheduledTaskIndexes(result.blocks, next)).toContain(1)
  })

  it('keeps v2 service blocks out of task reconcile and unscheduled calculations', () => {
    const blocks: BlockInput[] = [
      { id: 'meal-1', kind: 'meal', title: 'Обед', startMinutes: 780, durationMinutes: 45 },
      { id: 'task-1', kind: 'task', taskIndex: 1, taskText: 'A', startMinutes: 840, durationMinutes: 60 },
    ]

    const result = reconcileSchedule(blocks, [{ taskText: 'A' }], [{ taskText: 'B' }])

    expect(result.blocks).toEqual([blocks[0]])
    expect(result.removedBlockIds).toEqual(['task-1'])
    expect(computeUnscheduledTaskIndexes(result.blocks, [{ taskText: 'B' }])).toEqual([0])
  })

  it('handles duplicates with occurrence-aware matching', () => {
    const gen = seqGen()
    const blocks: BlockInput[] = [
      { id: gen(), taskIndex: 1, taskText: 'Call', startMinutes: 360, durationMinutes: 30 },
      { id: gen(), taskIndex: 3, taskText: 'Call', startMinutes: 420, durationMinutes: 30 },
    ]
    const prev = [{ taskText: 'Call' }, { taskText: 'Write' }, { taskText: 'Call' }]
    const next = [{ taskText: 'Email' }, { taskText: 'Write' }, { taskText: 'Call' }]
    const result = reconcileSchedule(blocks, prev, next)

    // First "Call" block (occurrence #1) matches the single remaining Call in next;
    // second Call block (occurrence #2) is removed because next has only one Call.
    expect(result.blocks.map(b => b.id)).toEqual([blocks[0].id])
    expect(isTaskScheduleBlock(result.blocks[0]) ? result.blocks[0].taskText : '').toBe('Call')
    expect(isTaskScheduleBlock(result.blocks[0]) ? result.blocks[0].taskIndex : 0).toBe(3)
    expect(result.removedBlockIds).toEqual([blocks[1].id])
  })

  it('returns empty blocks when current tasks are empty', () => {
    const gen = seqGen()
    const blocks = baseBlocks(gen)
    const prev = [{ taskText: 'A' }, { taskText: 'B' }, { taskText: 'C' }]
    const result = reconcileSchedule(blocks, prev, [])
    expect(result.blocks).toEqual([])
    expect(result.removedBlockIds).toEqual(blocks.map(b => b.id))
  })
})

describe('schedule-helpers · computeUnscheduledTaskIndexes', () => {
  it('marks all tasks unscheduled when blocks empty', () => {
    expect(computeUnscheduledTaskIndexes([], [{ taskText: 'A' }, { taskText: 'B' }])).toEqual([0, 1])
  })

  it('marks only tasks without blocks as unscheduled', () => {
    const blocks: BlockInput[] = [
      { id: '1', taskIndex: 1, taskText: 'A', startMinutes: 360, durationMinutes: 30 },
    ]
    const tasks = [{ taskText: 'A' }, { taskText: 'B' }]
    expect(computeUnscheduledTaskIndexes(blocks, tasks)).toEqual([1])
  })

  it('respects duplicates', () => {
    const blocks: BlockInput[] = [
      { id: '1', taskIndex: 1, taskText: 'Call', startMinutes: 360, durationMinutes: 30 },
    ]
    const tasks = [{ taskText: 'Call' }, { taskText: 'Call' }]
    // Only one "Call" is scheduled; the second occurrence is unscheduled.
    expect(computeUnscheduledTaskIndexes(blocks, tasks)).toEqual([1])
  })
})

describe('schedule-helpers · findFreeSlot', () => {
  it('returns dayStart when schedule is empty', () => {
    expect(findFreeSlot(60, 360, 1440, [])).toBe(360)
  })

  it('skips occupied ranges and finds the earliest gap', () => {
    const blocks: BlockInput[] = [
      { id: 'a', taskIndex: 1, taskText: 'A', startMinutes: 360, durationMinutes: 60 },
      { id: 'b', taskIndex: 2, taskText: 'B', startMinutes: 480, durationMinutes: 60 },
    ]
    // Earliest free slot of 60 min is 420 (after first block).
    expect(findFreeSlot(60, 360, 1440, blocks)).toBe(420)
  })

  it('returns null when no slot fits', () => {
    const blocks: BlockInput[] = [
      { id: 'a', taskIndex: 1, taskText: 'A', startMinutes: 360, durationMinutes: 60 },
    ]
    expect(findFreeSlot(60, 360, 420, blocks)).toBe(null)
  })

  it('respects earliestStart option', () => {
    const blocks: BlockInput[] = [
      { id: 'a', taskIndex: 1, taskText: 'A', startMinutes: 360, durationMinutes: 60 },
    ]
    expect(findFreeSlot(60, 360, 1440, blocks, { earliestStart: 510 })).toBe(510)
  })
})

describe('schedule-helpers · scheduleEquals', () => {
  it('compares nulls and content', () => {
    expect(scheduleEquals(null, null)).toBe(true)
    expect(scheduleEquals(null, buildSchedule('UTC', 360, 1440, []))).toBe(false)
  })

  it('treats reordered blocks as equal', () => {
    const tz = 'Europe/Moscow'
    const a = buildSchedule(tz, 360, 1440, [
      { id: '1', taskIndex: 1, taskText: 'A', startMinutes: 360, durationMinutes: 30 },
      { id: '2', taskIndex: 2, taskText: 'B', startMinutes: 420, durationMinutes: 30 },
    ])
    const b = buildSchedule(tz, 360, 1440, [
      { id: '2', taskIndex: 2, taskText: 'B', startMinutes: 420, durationMinutes: 30 },
      { id: '1', taskIndex: 1, taskText: 'A', startMinutes: 360, durationMinutes: 30 },
    ])
    expect(scheduleEquals(a, b)).toBe(true)
  })

  it('detects change in block start', () => {
    const tz = 'Europe/Moscow'
    const a = buildSchedule(tz, 360, 1440, [
      { id: '1', taskIndex: 1, taskText: 'A', startMinutes: 360, durationMinutes: 30 },
    ])
    const b = buildSchedule(tz, 360, 1440, [
      { id: '1', taskIndex: 1, taskText: 'A', startMinutes: 375, durationMinutes: 30 },
    ])
    expect(scheduleEquals(a, b)).toBe(false)
  })
})

describe('schedule-helpers · request lifecycle guards', () => {
  it('treats responses as current only when date and revision match', () => {
    const current = { date: '2026-07-15', revision: 3 }

    expect(isScheduleRequestCurrent({ date: '2026-07-15', revision: 3 }, current)).toBe(true)
    expect(isScheduleRequestCurrent({ date: '2026-07-14', revision: 3 }, current)).toBe(false)
    expect(isScheduleRequestCurrent({ date: '2026-07-15', revision: 2 }, current)).toBe(false)
  })

  it('decides what to do with pending debounce on date/revision changes', () => {
    expect(getPendingSaveDateChangeAction(null, { date: '2026-07-15', revision: 1 })).toBe('none')
    expect(
      getPendingSaveDateChangeAction(
        { date: '2026-07-15', revision: 1 },
        { date: '2026-07-15', revision: 1 },
      ),
    ).toBe('keep-current')
    expect(
      getPendingSaveDateChangeAction(
        { date: '2026-07-14', revision: 1 },
        { date: '2026-07-15', revision: 2 },
      ),
    ).toBe('flush-previous-date')
  })
})

describe('schedule-helpers · buildSchedule', () => {
  it('builds a v1 schedule', () => {
    const schedule = buildSchedule('UTC', DEFAULT_DAY_START_MINUTES, DEFAULT_DAY_END_MINUTES, [])
    expect(schedule.version).toBe(1)
    expect(schedule.timezone).toBe('UTC')
    expect(schedule.dayStartMinutes).toBe(DEFAULT_DAY_START_MINUTES)
    expect(schedule.dayEndMinutes).toBe(DEFAULT_DAY_END_MINUTES)
    expect(schedule.blocks).toEqual([])
    expect(getBlockEnd({ startMinutes: schedule.dayStartMinutes, durationMinutes: 0 })).toBe(schedule.dayStartMinutes)
  })
})
