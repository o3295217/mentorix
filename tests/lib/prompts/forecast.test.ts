import { describe, it, expect } from 'vitest'
import {
  calculateExecutionQuality,
  mergeExecutionQuality,
  buildForecastPrompt,
} from '@/lib/prompts/forecast'
import type { DayDataFull, ForecastRequest } from '@/lib/prompts/types'

function makeDay(overrides: Partial<DayDataFull> = {}): DayDataFull {
  return {
    date: '2026-01-01',
    planText: 'план',
    factText: 'факт',
    dreamProgressScore: 7,
    overallScore: 7,
    strategicFocusScore: 7,
    productivityScore: 7,
    lifeBalanceScore: 7,
    disciplineScore: 7,
    tasksPlanned: 5,
    tasksCompleted: 4,
    strategicTasks: 2,
    strategicCompleted: 1,
    ...overrides,
  }
}

describe('calculateExecutionQuality', () => {
  it('returns a zeroed quality object for an empty base period', () => {
    const result = calculateExecutionQuality([])

    expect(result.totalTasksPlanned).toBe(0)
    expect(result.totalTasksCompleted).toBe(0)
    expect(result.completionRate).toBe(0)
    expect(result.strategicCompletionRate).toBe(0)
    expect(result.trend).toBe('стабильно')
    expect(result.patterns).toEqual([])
  })

  it('aggregates tasks and completion rates across days', () => {
    const days = [
      makeDay({
        tasksPlanned: 4,
        tasksCompleted: 2,
        strategicTasks: 2,
        strategicCompleted: 1,
        dreamProgressScore: 5,
        overallScore: 5,
      }),
      makeDay({
        tasksPlanned: 6,
        tasksCompleted: 6,
        strategicTasks: 3,
        strategicCompleted: 3,
        dreamProgressScore: 9,
        overallScore: 9,
      }),
    ]

    const result = calculateExecutionQuality(days)

    expect(result.totalTasksPlanned).toBe(10)
    expect(result.totalTasksCompleted).toBe(8)
    expect(result.completionRate).toBe(80)
    expect(result.strategicTasksPlanned).toBe(5)
    expect(result.strategicTasksCompleted).toBe(4)
    expect(result.strategicCompletionRate).toBe(80)
    expect(result.avgDreamProgress).toBe(7)
    expect(result.avgOverallScore).toBe(7)
  })

  it('detects a growing trend when the second half of the period is notably better', () => {
    const days = [
      makeDay({ dreamProgressScore: 3 }),
      makeDay({ dreamProgressScore: 3 }),
      makeDay({ dreamProgressScore: 9 }),
      makeDay({ dreamProgressScore: 9 }),
    ]

    expect(calculateExecutionQuality(days).trend).toBe('растет')
  })

  it('detects a falling trend when the second half of the period is notably worse', () => {
    const days = [
      makeDay({ dreamProgressScore: 9 }),
      makeDay({ dreamProgressScore: 9 }),
      makeDay({ dreamProgressScore: 3 }),
      makeDay({ dreamProgressScore: 3 }),
    ]

    expect(calculateExecutionQuality(days).trend).toBe('падает')
  })
})

describe('mergeExecutionQuality', () => {
  it('keeps all server-computed numeric fields and fills patterns from the model output', () => {
    const computed = calculateExecutionQuality([makeDay()])
    const merged = mergeExecutionQuality(computed, ['паттерн 1', 'паттерн 2'])

    expect(merged.totalTasksPlanned).toBe(computed.totalTasksPlanned)
    expect(merged.totalTasksCompleted).toBe(computed.totalTasksCompleted)
    expect(merged.completionRate).toBe(computed.completionRate)
    expect(merged.strategicCompletionRate).toBe(computed.strategicCompletionRate)
    expect(merged.avgDreamProgress).toBe(computed.avgDreamProgress)
    expect(merged.trend).toBe(computed.trend)
    expect(merged.patterns).toEqual(['паттерн 1', 'паттерн 2'])
  })

  it('falls back to an empty patterns array when the model response is missing or malformed', () => {
    const computed = calculateExecutionQuality([makeDay()])

    expect(mergeExecutionQuality(computed, undefined).patterns).toEqual([])
    expect(mergeExecutionQuality(computed, null).patterns).toEqual([])
    expect(mergeExecutionQuality(computed, 'not-an-array').patterns).toEqual([])
  })

  it('filters out non-string entries from the model patterns array', () => {
    const computed = calculateExecutionQuality([makeDay()])

    expect(mergeExecutionQuality(computed, [1, 'ok', null, 'another']).patterns).toEqual([
      'ok',
      'another',
    ])
  })
})

describe('buildForecastPrompt', () => {
  const baseRequest: ForecastRequest = {
    basePeriodType: 'month',
    basePeriodStart: '2026-01-01',
    basePeriodEnd: '2026-01-31',
    baseDays: [makeDay()],
    forecastHorizon: 'quarter',
    horizonGoals: ['Цель 1', 'Цель 2'],
    horizonStart: '2026-02-01',
    horizonEnd: '2026-04-30',
    dreamGoal: 'Стать лучшей версией себя',
    dreamYears: 3,
    dreamMonths: 36,
  }

  it('never emits literal backslash-n sequences (real line breaks must be used instead)', () => {
    const prompt = buildForecastPrompt(baseRequest)

    expect(prompt).not.toContain('\\n')
  })

  it('renders each base-period day and each horizon goal on its own real line', () => {
    const prompt = buildForecastPrompt(baseRequest)

    expect(prompt).toContain('1. Цель 1\n2. Цель 2')
  })

  it('does not ask the model to echo back numeric executionQuality fields', () => {
    const prompt = buildForecastPrompt(baseRequest)

    expect(prompt).not.toContain('"totalTasksPlanned":')
    expect(prompt).not.toContain('"completionRate":')
    expect(prompt).not.toContain('"avgDreamProgress":')
    expect(prompt).toContain('"patterns": ["паттерн 1 из анализа"')
  })
})
