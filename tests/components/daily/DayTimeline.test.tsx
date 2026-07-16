import { describe, expect, it } from 'vitest'
import { canMutateTimeline, getScheduleBlockRenderKey } from '@/components/daily/DayTimeline'

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
