import { describe, expect, it } from 'vitest'
import { buildDayNightGradientCss, canMutateTimeline, getCompressedTimelineWindow, getDayNightGradientStops, getDropStartMinutesFromClientY, getScheduleBlockRenderKey, getTimelineAxisMarkerLabels, getTimelinePointerPreviewRange, getTimelineViewportHeight, getUnscheduledTrayViewConfig, getVisibleAxisMarks, isCurrentTimeLineVisible, isTaskHighlighted, shouldCommitPointerDrag, shouldStartTimelinePointerDrag } from '@/components/daily/DayTimeline'
import type { DailySchedule } from '@/lib/daily-schedule'

describe('getScheduleBlockRenderKey', () => {
  it('keeps stable block key before applied animation and remounts after each apply', () => {
    expect(getScheduleBlockRenderKey('block-1', 0)).toBe('block-1')
    expect(getScheduleBlockRenderKey('block-1', 1)).toBe('1:block-1')
    expect(getScheduleBlockRenderKey('block-1', 2)).toBe('2:block-1')
  })
})

describe('canMutateTimeline', () => {
  it('blocks timeline mutations only while explicit apply/chat lock is active', () => {
    expect(canMutateTimeline(false)).toBe(true)
    expect(canMutateTimeline(true)).toBe(false)
  })
})

describe('isTaskHighlighted', () => {
  it('highlights only task blocks whose taskIndex is selected', () => {
    const highlighted = new Set([2])

    expect(isTaskHighlighted({ id: 'task-2', kind: 'task', taskIndex: 2, taskText: 'Фокус', category: 'main', isFixed: false, startMinutes: 540, durationMinutes: 60 }, highlighted)).toBe(true)
    expect(isTaskHighlighted({ id: 'task-1', kind: 'task', taskIndex: 1, taskText: 'Почта', category: 'operational', isFixed: false, startMinutes: 600, durationMinutes: 30 }, highlighted)).toBe(false)
    expect(isTaskHighlighted({ id: 'meal', kind: 'meal', title: 'Обед', category: 'meal', isFixed: true, startMinutes: 720, durationMinutes: 45 }, highlighted)).toBe(false)
  })
})

describe('getTimelinePointerPreviewRange', () => {
  it('snaps pointer move to exact 15-minute steps and produces one commit range for pointerup', () => {
    expect(getTimelinePointerPreviewRange(9 * 60, 45, 90, 'move', 9 * 60, 18 * 60)).toEqual({
      startMinutes: 9 * 60 + 30,
      durationMinutes: 45,
    })
  })

  it('snaps resize to 45/90-minute boundaries and clamps inside day', () => {
    expect(getTimelinePointerPreviewRange(9 * 60 + 30, 45, 135, 'resize', 9 * 60, 18 * 60)).toEqual({
      startMinutes: 9 * 60 + 30,
      durationMinutes: 90,
    })
  })

  it('keeps resize start fixed at day boundary instead of shifting block backward', () => {
    expect(getTimelinePointerPreviewRange(17 * 60, 60, 180, 'resize', 9 * 60, 18 * 60)).toEqual({
      startMinutes: 17 * 60,
      durationMinutes: 60,
    })
  })
})

describe('shouldCommitPointerDrag', () => {
  it('commits only on pointerup after actual movement', () => {
    expect(shouldCommitPointerDrag('up', true, false)).toBe(true)
    expect(shouldCommitPointerDrag('up', false, false)).toBe(false)
  })

  it('does not commit on pointercancel or while locked', () => {
    expect(shouldCommitPointerDrag('cancel', true, false)).toBe(false)
    expect(shouldCommitPointerDrag('up', true, true)).toBe(false)
  })
})

describe('shouldStartTimelinePointerDrag', () => {
  it('lets touch scroll on the block body and starts touch drag only from its handle', () => {
    expect(shouldStartTimelinePointerDrag('touch', false)).toBe(false)
    expect(shouldStartTimelinePointerDrag('touch', true)).toBe(true)
  })

  it('preserves mouse dragging from the whole block', () => {
    expect(shouldStartTimelinePointerDrag('mouse', false)).toBe(true)
  })
})

describe('timeline drop and tray view helpers', () => {
  it('maps drop coordinate to snapped 15-minute start and clamps to default 30-minute duration', () => {
    expect(getDropStartMinutesFromClientY(145, 100, 9 * 60, 18 * 60)).toBe(9 * 60 + 15)
    expect(getDropStartMinutesFromClientY(2000, 100, 9 * 60, 18 * 60)).toBe(17 * 60 + 30)
  })

  it('documents compact tray with no duration controls and default 30-minute fallback', () => {
    expect(getUnscheduledTrayViewConfig()).toEqual({
      defaultDurationMinutes: 30,
      showsDurationControls: false,
      hint: 'Перетащите на шкалу или нажмите',
      chipItemClassName: 'w-[min(72vw,220px)] flex-shrink-0 sm:w-[220px]',
      chipButtonClassIncludes: ['w-full', 'cursor-grab', 'active:cursor-grabbing', 'disabled:cursor-not-allowed'],
      emptyCanvasText: null,
    })
  })

  it('does not expose service marker labels inside timeline axis', () => {
    expect(getTimelineAxisMarkerLabels()).toEqual([])
  })
})

describe('compressed timeline window', () => {
  const emptySchedule: DailySchedule = {
    version: 3,
    timezone: 'Europe/Moscow',
    dayStartMinutes: 360,
    dayEndMinutes: 1440,
    planningBasis: 'day_start',
    planningStartMinutes: 540,
    workEndMinutes: 1080,
    activityEndMinutes: 1200,
    blocks: [],
  }

  it('compresses empty timeline around planning window and can show full 00:00-24:00 day', () => {
    expect(getCompressedTimelineWindow(emptySchedule, false)).toEqual({ startMinutes: 540, endMinutes: 1080, isCompressed: true })
    expect(getCompressedTimelineWindow(emptySchedule, true)).toEqual({ startMinutes: 0, endMinutes: 1440, isCompressed: false })
  })

  it('always shows the full 00:00-24:00 day once the schedule has blocks, regardless of the plan\'s own day range', () => {
    // Plan built "from the current moment" (e.g. 16:30-21:00) must not cap the view —
    // the user needs to scroll freely up to morning and down to night.
    const scheduleWithNarrowRange: DailySchedule = {
      version: 3,
      timezone: 'Europe/Moscow',
      dayStartMinutes: 990, // 16:30
      dayEndMinutes: 1260, // 21:00
      planningBasis: 'current_time',
      planningStartMinutes: 990,
      workEndMinutes: 1260,
      activityEndMinutes: 1260,
      blocks: [
        { id: 'b1', kind: 'task', taskIndex: 1, taskText: 'Задача', category: 'main', isFixed: false, startMinutes: 1000, durationMinutes: 60 },
      ],
    }
    expect(getCompressedTimelineWindow(scheduleWithNarrowRange, false)).toEqual({ startMinutes: 0, endMinutes: 1440, isCompressed: false })
    expect(getCompressedTimelineWindow(scheduleWithNarrowRange, true)).toEqual({ startMinutes: 0, endMinutes: 1440, isCompressed: false })
  })

  it('shows current time line only today and inside visible window', () => {
    expect(isCurrentTimeLineVisible('2026-07-24', new Date('2026-07-24T10:15:00'), 480, 1260)).toBe(true)
    expect(isCurrentTimeLineVisible('2026-07-23', new Date('2026-07-24T10:15:00'), 480, 1260)).toBe(false)
    expect(isCurrentTimeLineVisible('2026-07-24', new Date('2026-07-24T23:15:00'), 480, 1260)).toBe(false)
  })

  it('caps full timeline viewport and keeps compressed empty timeline compact', () => {
    expect(getTimelineViewportHeight(3240, false)).toBe(560)
    expect(getTimelineViewportHeight(432, true)).toBe(432)
    expect(getTimelineViewportHeight(120, true)).toBe(240)
  })
})

describe('getVisibleAxisMarks', () => {
  const hourMarks = [9 * 60, 10 * 60, 11 * 60]
  const boundaryMarks = [9 * 60 + 15, 10 * 60 + 45]

  it('returns marks unchanged when the current-time line is not visible', () => {
    expect(getVisibleAxisMarks(hourMarks, boundaryMarks, null, 3)).toEqual({ hourMarks, boundaryMarks })
  })

  it('hides an hour mark the current-time pill overlaps (within 14px at the given scale)', () => {
    // 10:00 mark sits 3px away at PX_PER_MIN=3 (10:01 vs 10:00) — inside the 14px overlap band.
    const result = getVisibleAxisMarks(hourMarks, boundaryMarks, 10 * 60 + 1, 3)
    expect(result.hourMarks).toEqual([9 * 60, 11 * 60])
    expect(result.boundaryMarks).toEqual(boundaryMarks)
  })

  it('hides a block-boundary mark the current-time pill overlaps', () => {
    // 9:15 boundary sits 6px away at PX_PER_MIN=3 (9:17 vs 9:15) — inside the 14px overlap band.
    const result = getVisibleAxisMarks(hourMarks, boundaryMarks, 9 * 60 + 17, 3)
    expect(result.hourMarks).toEqual(hourMarks)
    expect(result.boundaryMarks).toEqual([10 * 60 + 45])
  })

  it('keeps a mark that is far enough from the current-time pill even in the compressed scale', () => {
    // At pxPerMinute=0.8, 14px covers 17.5 minutes — this mark is 30 min from the pill (24px), stays visible.
    const result = getVisibleAxisMarks([9 * 60], [], 9 * 60 + 30, 0.8)
    expect(result.hourMarks).toEqual([9 * 60])
  })

  it('hides a mark within the overlap band even at the compressed scale', () => {
    // At pxPerMinute=0.8, 14px covers 17.5 minutes — this mark is 15 min from the pill (12px), hidden.
    const result = getVisibleAxisMarks([9 * 60], [], 9 * 60 + 15, 0.8)
    expect(result.hourMarks).toEqual([])
  })
})

describe('getDayNightGradientStops', () => {
  const parseRgbaAlpha = (color: string): number => {
    const match = /rgba\([^)]+,\s*([\d.]+)\)/.exec(color)
    if (!match) throw new Error(`not an rgba() color: ${color}`)
    return Number(match[1])
  }

  it('produces stops with strictly ascending offsetPercent, spanning 0..100', () => {
    const stops = getDayNightGradientStops()
    expect(stops.length).toBeGreaterThanOrEqual(2)
    expect(stops[0].offsetPercent).toBe(0)
    expect(stops.at(-1)!.offsetPercent).toBe(100)
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].offsetPercent).toBeGreaterThan(stops[i - 1].offsetPercent)
    }
  })

  it('uses the same night color at 0% and 100% (midnight on both ends of the day)', () => {
    const stops = getDayNightGradientStops()
    expect(stops[0].color).toBe(stops.at(-1)!.color)
  })

  it('keeps every stop as a low-opacity rgba mood layer, never an opaque fill', () => {
    for (const stop of getDayNightGradientStops()) {
      const alpha = parseRgbaAlpha(stop.color)
      expect(alpha).toBeGreaterThan(0)
      expect(alpha).toBeLessThanOrEqual(0.6)
    }
  })

  it('places the day-plateau stops (~10:00-17:00) as the lightest/coolest and night as the darkest', () => {
    const stops = getDayNightGradientStops()
    const byOffset = (percent: number) => stops.find(s => Math.abs(s.offsetPercent - percent) < 0.5)
    const night = byOffset(0)!
    const day = byOffset((10 * 60 / 1440) * 100)!
    expect(night.color).not.toBe(day.color)
  })
})

describe('buildDayNightGradientCss', () => {
  it('renders a top-to-bottom CSS linear-gradient listing every stop in order', () => {
    const css = buildDayNightGradientCss([
      { offsetPercent: 0, color: 'rgba(1, 2, 3, 0.5)' },
      { offsetPercent: 50, color: 'rgba(4, 5, 6, 0.4)' },
      { offsetPercent: 100, color: 'rgba(1, 2, 3, 0.5)' },
    ])
    expect(css).toBe('linear-gradient(to bottom, rgba(1, 2, 3, 0.5) 0%, rgba(4, 5, 6, 0.4) 50%, rgba(1, 2, 3, 0.5) 100%)')
  })

  it('round-trips the real day/night stops into a well-formed gradient string', () => {
    const css = buildDayNightGradientCss(getDayNightGradientStops())
    expect(css.startsWith('linear-gradient(to bottom, ')).toBe(true)
    expect(css.endsWith(')')).toBe(true)
    expect(css).toContain('0%')
    expect(css).toContain('100%')
  })
})
