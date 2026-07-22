import { describe, expect, it } from 'vitest'
import { canMutateTimeline, getDropStartMinutesFromClientY, getScheduleBlockRenderKey, getTimelineAxisMarkerLabels, getTimelinePointerPreviewRange, getUnscheduledTrayViewConfig, shouldCommitPointerDrag, shouldStartTimelinePointerDrag } from '@/components/daily/DayTimeline'

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
      hint: 'Перетащите задачу на шкалу',
      chipItemClassName: 'w-[min(76vw,240px)] flex-shrink-0 md:w-[240px]',
      chipButtonClassIncludes: ['w-full', 'cursor-grab', 'active:cursor-grabbing', 'disabled:cursor-not-allowed'],
      emptyCanvasText: null,
    })
  })

  it('does not expose service marker labels inside timeline axis', () => {
    expect(getTimelineAxisMarkerLabels()).toEqual([])
  })
})
