import { describe, expect, it } from 'vitest'
import { computeDailyScheduleLoadSummary, type DailySchedule } from '@/lib/daily-schedule'
import {
  DEFAULT_DAY_END_MINUTES,
  DEFAULT_DAY_START_MINUTES,
  type BlockInput,
  applyCascadeScheduleEdit,
  autoLayoutBlocks,
  buildSchedule,
  clamp,
  clampBlockToRange,
  computeClientScheduleLoadSummary,
  computeUnscheduledTaskIndexes,
  expandScheduleBoundsForBlock,
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
  renameTaskScheduleBlocks,
  reconcileSchedule,
  scheduleEquals,
  snapDownToStep,
  snapToStep,
  timeLabelToMinutes,
} from '@/hooks/daily/schedule-helpers'
import { canApplySavedScheduleToCurrentDate, withScheduleBlocks } from '@/hooks/daily/useDailySchedule'

const onlyTaskBlocks = (blocks: BlockInput[]) => blocks.filter(isTaskScheduleBlock)

const DAY_START = 6 * 60
const DAY_END = 24 * 60
const at = (hours: number, minutes = 0) => hours * 60 + minutes
const seqGen = () => {
  let i = 0
  return () => `b-${++i}`
}

const block = (id: string, startMinutes: number, durationMinutes: number, taskIndex = 1): BlockInput => ({
  id,
  taskIndex,
  taskText: id.toUpperCase(),
  startMinutes,
  durationMinutes,
})

const v3Task = (id: string, startMinutes: number, durationMinutes: number, isFixed = false, taskIndex = 1): BlockInput => ({
  id,
  kind: 'task',
  taskIndex,
  taskText: id.toUpperCase(),
  startMinutes,
  durationMinutes,
  category: 'main',
  isFixed,
})

const v3FixedBuffer = (id: string, startMinutes: number, durationMinutes: number): BlockInput => ({
  id,
  kind: 'buffer',
  title: id.toUpperCase(),
  startMinutes,
  durationMinutes,
  category: 'buffer',
  isFixed: true,
})

const schedule = (blocks: BlockInput[], dayStartMinutes = at(9), dayEndMinutes = at(18)): DailySchedule => ({
  version: 1,
  timezone: 'UTC',
  dayStartMinutes,
  dayEndMinutes,
  blocks: blocks as Extract<DailySchedule, { version: 1 }>['blocks'],
})

const v3Schedule = (blocks: BlockInput[]): DailySchedule => ({
  version: 3,
  timezone: 'UTC',
  dayStartMinutes: at(9),
  dayEndMinutes: at(21, 30),
  planningBasis: 'day_start',
  planningStartMinutes: at(9),
  workEndMinutes: at(18),
  activityEndMinutes: at(21, 30),
  blocks: blocks as Extract<DailySchedule, { version: 3 }>['blocks'],
})

const expectOk = (result: ReturnType<typeof applyCascadeScheduleEdit>) => {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.message)
  return result
}

describe('schedule-helpers · time & numeric primitives', () => {
  it('snaps interaction edits to 15-minute step (round and floor)', () => {
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

  it('clamps block to range with 15-minute interaction step', () => {
    const r = clampBlockToRange({ startMinutes: 350, durationMinutes: 22 }, 360, 1440)
    expect(r).toEqual({ startMinutes: 360, durationMinutes: 15 })

    const r2 = clampBlockToRange({ startMinutes: 1500, durationMinutes: 60 }, 360, 1440)
    // duration is clamped to span, then start clamped so end <= 1440
    expect(r2.startMinutes + r2.durationMinutes).toBeLessThanOrEqual(1440)
    expect(r2.startMinutes).toBeGreaterThanOrEqual(360)
  })
})

describe('schedule-helpers · applyCascadeScheduleEdit', () => {
  it('inserts into an occupied block and shifts a 45/90-minute chain from 09:30', () => {
    const result = expectOk(applyCascadeScheduleEdit(
      schedule([
        block('a', at(9), 45, 1),
        block('b', at(9, 45), 90, 2),
        block('c', at(11, 15), 45, 3),
      ], at(9), at(14)),
      { type: 'insert', block: block('x', 0, 45, 4), startMinutes: at(9, 30) },
    ))

    expect(result.schedule.blocks.map(({ id, startMinutes, durationMinutes }) => [id, startMinutes, durationMinutes])).toEqual([
      ['x', at(9, 30), 45],
      ['a', at(10, 15), 45],
      ['b', at(11), 90],
      ['c', at(12, 30), 45],
    ])
    expect(result.changedBlockIds).toEqual(['x', 'a', 'b', 'c'])
  })

  it('drops a default 30-minute task at requested occupied start and cascades followers', () => {
    const result = expectOk(applyCascadeScheduleEdit(
      schedule([block('a', at(9), 60, 1), block('b', at(10), 60, 2)], at(9), at(12)),
      { type: 'insert', block: block('x', 0, 30, 3), startMinutes: at(9, 30), durationMinutes: 30 },
    ))

    expect(result.schedule.blocks.map(({ id, startMinutes, durationMinutes }) => [id, startMinutes, durationMinutes])).toEqual([
      ['x', at(9, 30), 30],
      ['a', at(10), 60],
      ['b', at(11), 60],
    ])
  })

  it('moves a block down and cascades following flexible blocks', () => {
    const result = expectOk(applyCascadeScheduleEdit(
      schedule([block('a', at(9), 60, 1), block('b', at(10), 60, 2), block('c', at(11), 60, 3)], at(9), at(14)),
      { type: 'move', blockId: 'a', startMinutes: at(10, 30) },
    ))

    expect(result.schedule.blocks.map(({ id, startMinutes }) => [id, startMinutes])).toEqual([
      ['a', at(10, 30)],
      ['b', at(11, 30)],
      ['c', at(12, 30)],
    ])
  })

  it('moves a block up, removes it from calculation, and lets the old gap absorb part of the shift', () => {
    const result = expectOk(applyCascadeScheduleEdit(
      schedule([block('a', at(9), 60, 1), block('b', at(10), 60, 2), block('c', at(11), 60, 3)], at(9), at(13)),
      { type: 'move', blockId: 'c', startMinutes: at(9, 30) },
    ))

    expect(result.schedule.blocks.map(({ id, startMinutes }) => [id, startMinutes])).toEqual([
      ['c', at(9, 30)],
      ['a', at(10, 30)],
      ['b', at(11, 30)],
    ])
  })

  it('uses existing gaps to stop the cascade', () => {
    const result = expectOk(applyCascadeScheduleEdit(
      schedule([block('a', at(9), 60, 1), block('b', at(11), 60, 2), block('c', at(12), 60, 3)], at(9), at(14)),
      { type: 'insert', block: block('x', 0, 30, 4), startMinutes: at(9, 30) },
    ))

    expect(result.schedule.blocks.map(({ id, startMinutes }) => [id, startMinutes])).toEqual([
      ['x', at(9, 30)],
      ['a', at(10)],
      ['b', at(11)],
      ['c', at(12)],
    ])
    expect(result.changedBlockIds).toEqual(['x', 'a'])
  })

  it('rejects a cascade that would collide with a fixed 18:00–20:00 block', () => {
    const result = applyCascadeScheduleEdit(
      v3Schedule([
        v3Task('a', at(17, 30), 30, false, 1),
        v3FixedBuffer('fixed', at(18), 120),
      ]),
      { type: 'insert', block: v3Task('x', 0, 30, false, 2), startMinutes: at(17, 15) },
    )

    expect(result).toMatchObject({ ok: false, reason: 'fixed-collision', blockId: 'a', conflictingBlockId: 'fixed' })
  })

  it('allows touching fixed 18:00–20:00 and 20:00–21:30 boundaries but rejects activity overflow', () => {
    const boundary = expectOk(applyCascadeScheduleEdit(
      v3Schedule([v3FixedBuffer('fixed', at(18), 120)]),
      { type: 'insert', block: v3Task('x', 0, 90, false, 1), startMinutes: at(20) },
    ))
    expect(boundary.schedule.blocks.map(({ id, startMinutes, durationMinutes }) => [id, startMinutes, durationMinutes])).toEqual([
      ['fixed', at(18), 120],
      ['x', at(20), 90],
    ])

    const overflow = applyCascadeScheduleEdit(
      v3Schedule([v3FixedBuffer('fixed', at(18), 120)]),
      { type: 'insert', block: v3Task('late', 0, 90, false, 1), startMinutes: at(20, 15) },
    )
    expect(overflow).toMatchObject({ ok: false, reason: 'overflow', blockId: 'late', limitMinutes: at(21, 30) })
  })

  it('grows a block by cascading flexible followers', () => {
    const result = expectOk(applyCascadeScheduleEdit(
      schedule([block('a', at(9), 60, 1), block('b', at(10), 45, 2), block('c', at(10, 45), 45, 3)], at(9), at(13)),
      { type: 'resize', blockId: 'a', durationMinutes: 90 },
    ))

    expect(result.schedule.blocks.map(({ id, startMinutes, durationMinutes }) => [id, startMinutes, durationMinutes])).toEqual([
      ['a', at(9), 90],
      ['b', at(10, 30), 45],
      ['c', at(11, 15), 45],
    ])
  })

  it('shrinks a block and leaves a gap instead of pulling followers up', () => {
    const result = expectOk(applyCascadeScheduleEdit(
      schedule([block('a', at(9), 90, 1), block('b', at(10, 30), 45, 2)], at(9), at(12)),
      { type: 'resize', blockId: 'a', durationMinutes: 45 },
    ))

    expect(result.schedule.blocks.map(({ id, startMinutes, durationMinutes }) => [id, startMinutes, durationMinutes])).toEqual([
      ['a', at(9), 45],
      ['b', at(10, 30), 45],
    ])
    expect(result.changedBlockIds).toEqual(['a'])
  })

  it('does not mutate the input schedule', () => {
    const input = schedule([block('a', at(9), 60, 1), block('b', at(10), 60, 2)], at(9), at(12))
    const snapshot = JSON.parse(JSON.stringify(input)) as DailySchedule

    expectOk(applyCascadeScheduleEdit(input, { type: 'move', blockId: 'a', startMinutes: at(9, 30) }))

    expect(input).toEqual(snapshot)
  })

  it('snaps requested interaction starts and durations to 15-minute intervals', () => {
    const result = expectOk(applyCascadeScheduleEdit(
      schedule([], at(9), at(11)),
      { type: 'insert', block: block('x', 0, 22, 1), startMinutes: at(9, 37), durationMinutes: 22 },
    ))

    expect(result.schedule.blocks[0]).toMatchObject({ startMinutes: at(9, 30), durationMinutes: 15 })
    expect(result.schedule.blocks.every(item => item.startMinutes % 15 === 0 && item.durationMinutes % 15 === 0)).toBe(true)
  })

  it('keeps a moved fixed block fixed while treating other fixed blocks as barriers', () => {
    const result = expectOk(applyCascadeScheduleEdit(
      v3Schedule([v3Task('fixed-task', at(9), 60, true, 1), v3Task('flex', at(10), 60, false, 2)]),
      { type: 'move', blockId: 'fixed-task', startMinutes: at(9, 30) },
    ))

    expect(result.schedule.blocks[0]).toMatchObject({ id: 'fixed-task', startMinutes: at(9, 30), isFixed: true })
    expect(result.schedule.blocks[1]).toMatchObject({ id: 'flex', startMinutes: at(10, 30) })
  })
})

describe('schedule-helpers · client load summary parity', () => {
  it('matches server summary for 09:30–21:30 category sample with active denominator', () => {
    const sample: DailySchedule = {
      version: 3,
      timezone: 'Europe/Moscow',
      dayStartMinutes: at(9, 30),
      dayEndMinutes: at(21, 30),
      planningBasis: 'custom_time',
      planningStartMinutes: at(9, 30),
      workEndMinutes: at(18),
      activityEndMinutes: at(21, 30),
      blocks: [
        { id: 'main', kind: 'task', taskIndex: 1, taskText: 'Фокус', category: 'main', isFixed: false, startMinutes: at(9, 30), durationMinutes: 135 },
        { id: 'personal', kind: 'task', taskIndex: 2, taskText: 'Личное', category: 'personal', isFixed: false, startMinutes: at(15), durationMinutes: 120 },
        { id: 'travel', kind: 'buffer', title: 'Дорога', category: 'travel', isFixed: true, startMinutes: at(20), durationMinutes: 90 },
      ],
    }

    const client = computeClientScheduleLoadSummary(sample)
    const server = computeDailyScheduleLoadSummary(sample)
    expect(client).toEqual(server)
    expect(client.activeInterval.availableMinutes).toBe(720)
    expect(client.categories.main).toMatchObject({ minutes: 135, percent: 18.75 })
    expect(client.categories.personal).toMatchObject({ minutes: 120, percent: 16.67 })
    expect(client.categories.travel).toMatchObject({ minutes: 90, percent: 12.5 })
    expect(client.scheduledMinutes).toBe(345)
    expect(client.scheduledPercent).toBe(47.92)
  })
})

describe('schedule-helpers · v3 shape preservation and dirty detection', () => {
  it('preserves v3 service blocks, category and fixed flags when replacing blocks', () => {
    const current = v3Schedule([
      v3Task('task', at(9), 60, false, 1),
      { id: 'travel', kind: 'buffer', title: 'Дорога', category: 'travel', isFixed: true, startMinutes: at(18), durationMinutes: 90 },
    ])
    const next = withScheduleBlocks(current, [current.blocks[1]])

    expect(next.version).toBe(3)
    expect(next.blocks).toEqual([{ id: 'travel', kind: 'buffer', title: 'Дорога', category: 'travel', isFixed: true, startMinutes: at(18), durationMinutes: 90 }])
  })

  it('reconcile keeps v3 service blocks and task category/isFixed on task reorder', () => {
    const current = v3Schedule([
      { ...v3Task('a', at(9), 60, false, 1), category: 'personal' },
      { id: 'fixed-meal', kind: 'meal', title: 'Обед', category: 'meal', isFixed: true, startMinutes: at(13), durationMinutes: 45 },
    ])
    const result = reconcileSchedule(current.blocks, [{ taskText: 'A' }], [{ taskText: 'A updated' }, { taskText: 'A' }])

    expect(result.blocks.find(block => block.id === 'fixed-meal')).toMatchObject({ kind: 'meal', category: 'meal', isFixed: true })
    expect(result.blocks.find(block => block.id === 'a')).toMatchObject({ taskIndex: 2, taskText: 'A', category: 'personal', isFixed: false })
  })

  it('scheduleEquals detects v3 planning fields, category and fixed differences', () => {
    const base = v3Schedule([v3Task('a', at(9), 60, false, 1)])
    expect(scheduleEquals(base, { ...base, workEndMinutes: at(19) })).toBe(false)
    expect(scheduleEquals(base, { ...base, blocks: [{ ...base.blocks[0], category: 'personal' }] as Extract<DailySchedule, { version: 3 }>['blocks'] })).toBe(false)
    expect(scheduleEquals(base, { ...base, blocks: [{ ...base.blocks[0], isFixed: true }] as Extract<DailySchedule, { version: 3 }>['blocks'] })).toBe(false)
  })

  it('guards stale apply responses when date changed from A to B', () => {
    expect(canApplySavedScheduleToCurrentDate('2026-07-16', '2026-07-16')).toBe(true)
    expect(canApplySavedScheduleToCurrentDate('2026-07-16', '2026-07-17')).toBe(false)
    expect(canApplySavedScheduleToCurrentDate(undefined, '2026-07-17')).toBe(true)
  })
})

describe('schedule-helpers · expandScheduleBoundsForBlock', () => {
  it('leaves the schedule untouched (same reference) when the block is fully inside the current range', () => {
    const current = v3Schedule([]) // dayStart 9:00, dayEnd 21:30
    const next = expandScheduleBoundsForBlock(current, { startMinutes: at(10), durationMinutes: 60 })
    expect(next).toBe(current)
  })

  it('widens dayStartMinutes when the block starts earlier than the current day range', () => {
    const current = schedule([], at(9), at(18)) // v1: 9:00-18:00
    const next = expandScheduleBoundsForBlock(current, { startMinutes: at(6), durationMinutes: 30 })
    expect(next.dayStartMinutes).toBe(at(6))
    expect(next.dayEndMinutes).toBe(at(18))
  })

  it('widens dayEndMinutes when the block ends later than the current day range', () => {
    const current = schedule([], at(9), at(18)) // v1: 9:00-18:00
    const next = expandScheduleBoundsForBlock(current, { startMinutes: at(22), durationMinutes: 60 })
    expect(next.dayStartMinutes).toBe(at(9))
    expect(next.dayEndMinutes).toBe(at(23))
  })

  it('widens both ends for a block spanning wider than the current day range', () => {
    const current = schedule([], at(9), at(18))
    const next = expandScheduleBoundsForBlock(current, { startMinutes: at(6), durationMinutes: at(18) })
    expect(next.dayStartMinutes).toBe(at(6))
    expect(next.dayEndMinutes).toBe(at(24))
  })

  it('for v3 schedules keeps planningStartMinutes === dayStartMinutes and activityEndMinutes === dayEndMinutes after widening', () => {
    const current = v3Schedule([]) // dayStart 9:00, dayEnd 21:30, workEnd 18:00
    const next = expandScheduleBoundsForBlock(current, { startMinutes: at(7), durationMinutes: 30 })
    expect(next.version).toBe(3)
    if (next.version !== 3) throw new Error('expected v3')
    expect(next.dayStartMinutes).toBe(at(7))
    expect(next.planningStartMinutes).toBe(at(7))
    expect(next.dayEndMinutes).toBe(at(21, 30))
    expect(next.activityEndMinutes).toBe(at(21, 30))
    // workEndMinutes untouched — the block ends well before it.
    expect(next.workEndMinutes).toBe(at(18))
  })

  it('for v3 schedules pushes workEndMinutes forward when the block ends after it, even if the day range itself does not need to widen', () => {
    const current = v3Schedule([]) // workEnd 18:00, dayEnd/activityEnd 21:30
    const next = expandScheduleBoundsForBlock(current, { startMinutes: at(19), durationMinutes: 60 }) // ends 20:00, inside old day range but after workEnd
    expect(next.version).toBe(3)
    if (next.version !== 3) throw new Error('expected v3')
    // Day range (dayStart/dayEnd/activityEnd) is untouched — the block already fit inside it.
    expect(next.dayStartMinutes).toBe(at(9))
    expect(next.dayEndMinutes).toBe(at(21, 30))
    expect(next.activityEndMinutes).toBe(at(21, 30))
    // workEndMinutes is pushed to the block's end so the "Работа до" pill and AI-proposal
    // layout building on it stay consistent with where the block actually was placed.
    expect(next.workEndMinutes).toBe(at(20))
  })

  it('for v3 schedules pushes workEndMinutes forward together with a day-range widening block', () => {
    const current = v3Schedule([]) // dayEnd/activityEnd 21:30, workEnd 18:00
    const next = expandScheduleBoundsForBlock(current, { startMinutes: at(22), durationMinutes: 60 }) // ends 23:00, past dayEnd and workEnd
    expect(next.version).toBe(3)
    if (next.version !== 3) throw new Error('expected v3')
    expect(next.dayEndMinutes).toBe(at(23))
    expect(next.activityEndMinutes).toBe(at(23))
    expect(next.workEndMinutes).toBe(at(23))
  })

  it('clamps the widened workEndMinutes to the new activityEnd rather than exceeding it', () => {
    const current = v3Schedule([]) // dayEnd/activityEnd 21:30
    const next = expandScheduleBoundsForBlock(current, { startMinutes: at(21), durationMinutes: 30 }) // ends exactly at old activityEnd
    expect(next.version).toBe(3)
    if (next.version !== 3) throw new Error('expected v3')
    // Block fits inside the old day range (21:00-21:30 <= 21:30) so dayEnd/activityEnd stay put,
    // but the block ends after the old workEnd (18:00) — workEnd is pushed up to it, capped at activityEnd.
    expect(next.dayEndMinutes).toBe(at(21, 30))
    expect(next.activityEndMinutes).toBe(at(21, 30))
    expect(next.workEndMinutes).toBe(at(21, 30))
    expect(next.workEndMinutes).toBeLessThanOrEqual(next.activityEndMinutes)
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

  it('keeps the schedule block linked when task text is edited in place', () => {
    const gen = seqGen()
    const blocks = baseBlocks(gen)
    const prev = [{ taskText: 'A' }, { taskText: 'B' }, { taskText: 'C' }]
    const next = [{ taskText: 'A' }, { taskText: 'B2' }, { taskText: 'C' }]
    const renamedBlocks = renameTaskScheduleBlocks(blocks, 2, 'B2')
    const result = reconcileSchedule(renamedBlocks, prev, next)

    expect(onlyTaskBlocks(result.blocks).map(b => b.id)).toEqual(blocks.map(b => b.id))
    expect(onlyTaskBlocks(result.blocks).map(b => b.taskText)).toEqual(['A', 'B2', 'C'])
    expect(onlyTaskBlocks(result.blocks).map(b => b.taskIndex)).toEqual([1, 2, 3])
    expect(result.removedBlockIds).toEqual([])
    expect(computeUnscheduledTaskIndexes(result.blocks, next)).not.toContain(1)
  })

  it('keeps v2 service blocks out of task reconcile and unscheduled calculations', () => {
    const blocks: BlockInput[] = [
      { id: 'meal-1', kind: 'meal', title: 'Обед', startMinutes: 780, durationMinutes: 45 },
      { id: 'task-1', kind: 'task', taskIndex: 1, taskText: 'A', startMinutes: 840, durationMinutes: 60 },
    ]

    const renamedBlocks = renameTaskScheduleBlocks(blocks, 1, 'B')
    const result = reconcileSchedule(renamedBlocks, [{ taskText: 'A' }], [{ taskText: 'B' }])

    expect(result.blocks).toEqual([
      blocks[0],
      { ...blocks[1], taskText: 'B' },
    ])
    expect(result.removedBlockIds).toEqual([])
    expect(computeUnscheduledTaskIndexes(result.blocks, [{ taskText: 'B' }])).toEqual([])
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
