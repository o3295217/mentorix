import { describe, expect, it } from 'vitest'
import { countSavedPlanTasks, getDailyPhase } from '@/hooks/daily/phase-helpers'

const base = {
  selectedDate: '2026-07-24',
  todayDate: '2026-07-24',
  savedTaskCount: 3,
  totalTaskCount: 3,
  completedTaskCount: 1,
  currentMinutes: 10 * 60,
  workStartMinutes: 9 * 60,
  workEndMinutes: 18 * 60,
}

describe('daily phase helpers', () => {
  it('returns neutral for non-today dates', () => {
    expect(getDailyPhase({ ...base, selectedDate: '2026-07-23' })).toBe('neutral')
  })

  it('detects planning for today without saved tasks', () => {
    expect(getDailyPhase({ ...base, savedTaskCount: 0, totalTaskCount: 0, completedTaskCount: 0 })).toBe('planning')
  })

  it('detects planning before the work window even when a plan already exists', () => {
    expect(getDailyPhase({ ...base, currentMinutes: 8 * 60 })).toBe('planning')
  })

  it('detects execution inside work window with saved plan', () => {
    expect(getDailyPhase(base)).toBe('execution')
  })

  it('detects summary after work window or when all tasks are completed', () => {
    expect(getDailyPhase({ ...base, currentMinutes: 19 * 60 })).toBe('summary')
    expect(getDailyPhase({ ...base, completedTaskCount: 3 })).toBe('summary')
  })

  it('counts saved plan lines defensively', () => {
    expect(countSavedPlanTasks(' A \n\n B ')).toBe(2)
    expect(countSavedPlanTasks(null)).toBe(0)
  })
})
