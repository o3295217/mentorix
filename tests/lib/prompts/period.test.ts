import { describe, it, expect } from 'vitest'
import { calculatePeriodAverages, buildPeriodEvaluationPrompt } from '@/lib/prompts/period'
import type { DayData, PeriodEvaluationRequest } from '@/lib/prompts/types'

function makeDay(overrides: Partial<DayData> = {}): DayData {
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
    ...overrides,
  }
}

describe('calculatePeriodAverages', () => {
  it('returns all zeros for an empty period (avoids division by zero)', () => {
    expect(calculatePeriodAverages([])).toEqual({
      avgDreamProgress: 0,
      avgOverall: 0,
      avgStrategicFocus: 0,
      avgProductivity: 0,
      avgLifeBalance: 0,
      avgDiscipline: 0,
    })
  })

  it('averages each score field across days and rounds to 1 decimal', () => {
    const days = [
      makeDay({
        dreamProgressScore: 8,
        overallScore: 7,
        strategicFocusScore: 9,
        productivityScore: 6,
        lifeBalanceScore: 5,
        disciplineScore: 8,
      }),
      makeDay({
        dreamProgressScore: 5,
        overallScore: 6,
        strategicFocusScore: 4,
        productivityScore: 8,
        lifeBalanceScore: 7,
        disciplineScore: 5,
      }),
      makeDay({
        dreamProgressScore: 9,
        overallScore: 8,
        strategicFocusScore: 8,
        productivityScore: 7,
        lifeBalanceScore: 6,
        disciplineScore: 9,
      }),
    ]

    const avg = calculatePeriodAverages(days)

    // (8+5+9)/3 = 7.333... -> 7.3
    expect(avg.avgDreamProgress).toBe(7.3)
    // (7+6+8)/3 = 7
    expect(avg.avgOverall).toBe(7)
    // (9+4+8)/3 = 7
    expect(avg.avgStrategicFocus).toBe(7)
    // (6+8+7)/3 = 7
    expect(avg.avgProductivity).toBe(7)
    // (5+7+6)/3 = 6
    expect(avg.avgLifeBalance).toBe(6)
    // (8+5+9)/3 = 7.333... -> 7.3
    expect(avg.avgDiscipline).toBe(7.3)
  })
})

describe('buildPeriodEvaluationPrompt', () => {
  const baseRequest: PeriodEvaluationRequest = {
    periodType: 'month',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    days: [makeDay({ dreamProgressScore: 8 }), makeDay({ dreamProgressScore: 6 })],
    goals: {
      dreamGoal: 'Мечта',
      yearGoals: ['Год цель'],
      halfYearGoals: [],
      quarterGoals: [],
      monthGoals: ['Месяц цель'],
      weekGoals: [],
    },
  }

  it('includes a precomputed averages block instead of asking the model to calculate them', () => {
    const prompt = buildPeriodEvaluationPrompt(baseRequest)

    expect(prompt).toContain('СРЕДНИЕ ПОКАЗАТЕЛИ (уже рассчитаны, используй эти числа)')
    expect(prompt).toContain('ИСПОЛЬЗУЙ ПРЕДОСТАВЛЕННЫЕ СРЕДНИЕ ПОКАЗАТЕЛИ')
    expect(prompt).not.toContain('1. РАССЧИТАЙ СРЕДНИЕ ПОКАЗАТЕЛИ')
  })

  it('maps professionalBlock fields to the correct averaged scores explicitly', () => {
    const prompt = buildPeriodEvaluationPrompt(baseRequest)

    expect(prompt).toContain('professionalBlock.strategyAvg')
    expect(prompt).toContain('professionalBlock.operationsAvg')
    expect(prompt).toContain('professionalBlock.teamAvg')
    expect(prompt).toContain('strategyAvg = среднее strategicFocusScore')
    expect(prompt).toContain('operationsAvg = среднее productivityScore')
    expect(prompt).toContain('teamAvg = среднее disciplineScore')
  })

  it('is honest about missing plan/fact and networking data instead of asking to analyze it', () => {
    const prompt = buildPeriodEvaluationPrompt(baseRequest)

    expect(prompt).toContain('недостаточно данных для точной оценки')
    expect(prompt).not.toContain('Нетворкинг, командная работа')
    expect(prompt).not.toContain('анализируй план/факт')
  })

  it('embeds the actual computed averages for this request', () => {
    const prompt = buildPeriodEvaluationPrompt(baseRequest)
    const averages = calculatePeriodAverages(baseRequest.days)

    expect(prompt).toContain(`dreamProgressScore: ${averages.avgDreamProgress}`)
    expect(prompt).toContain(`overallScore: ${averages.avgOverall}`)
  })
})
