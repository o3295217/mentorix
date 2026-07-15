import { describe, expect, it } from 'vitest'
import { CHECK_PLAN_SYSTEM_PROMPT } from '@/lib/prompts/check-plan'
import { DAILY_EVALUATION_SYSTEM_PROMPT } from '@/lib/prompts/daily'
import { buildForecastPrompt } from '@/lib/prompts/forecast'
import { buildUpdateInsightsPrompt } from '@/lib/prompts/insights'
import { buildPeriodEvaluationPrompt } from '@/lib/prompts/period'
import type { DayData, DayDataFull, ForecastRequest, PeriodEvaluationRequest } from '@/lib/prompts/types'

function expectNoEmojiOutputRule(prompt: string): void {
  expect(prompt).toContain('ПРАВИЛО ВЫВОДА БЕЗ EMOJI')
  expect(prompt).toContain('Не используй emoji ни в одном пользовательском текстовом поле или ответе')
  expect(prompt).toContain('Допускаются обычная пунктуация, цифры, тире и текстовые списки')
  expect(prompt).toContain('Внутренние emoji-маркеры из контекста и заголовков не копируй в ответ')
}

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

function makeFullDay(overrides: Partial<DayDataFull> = {}): DayDataFull {
  return {
    ...makeDay(),
    tasksPlanned: 3,
    tasksCompleted: 2,
    strategicTasks: 1,
    strategicCompleted: 1,
    ...overrides,
  }
}

describe('no emoji output rule in user-facing AI prompts', () => {
  it('is included in daily evaluation prompt', () => {
    expectNoEmojiOutputRule(DAILY_EVALUATION_SYSTEM_PROMPT)
  })

  it('is included in forecast prompt', () => {
    const request: ForecastRequest = {
      basePeriodType: 'week',
      basePeriodStart: '2026-01-01',
      basePeriodEnd: '2026-01-07',
      baseDays: [makeFullDay()],
      forecastHorizon: 'month',
      horizonGoals: ['Цель месяца'],
      dreamGoal: 'Мечта',
      dreamMonths: 12,
    }

    expectNoEmojiOutputRule(buildForecastPrompt(request))
  })

  it('is included in period evaluation prompt', () => {
    const request: PeriodEvaluationRequest = {
      periodType: 'week',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-07',
      days: [makeDay()],
      goals: {
        dreamGoal: 'Мечта',
        yearGoals: [],
        halfYearGoals: [],
        quarterGoals: [],
        monthGoals: [],
        weekGoals: [],
      },
    }

    expectNoEmojiOutputRule(buildPeriodEvaluationPrompt(request))
  })

  it('is included in check-plan prompt', () => {
    expectNoEmojiOutputRule(CHECK_PLAN_SYSTEM_PROMPT)
  })

  it('is included in insights update prompt', () => {
    const prompt = buildUpdateInsightsPrompt({
      currentInsights: null,
      evaluationCount: 1,
      planText: 'Сделать стратегическую задачу',
      factText: 'Сделал',
      evaluationFeedback: 'Есть прогресс',
      dreamProgressScore: 7,
      overallScore: 7,
      date: '2026-01-01',
    })

    expectNoEmojiOutputRule(prompt)
  })
})
