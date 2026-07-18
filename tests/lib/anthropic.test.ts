import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DailyEvaluationRequest,
  PeriodEvaluationRequest,
  ForecastRequest,
} from '@/lib/prompts/types'

const messagesCreateMock = vi.fn()

const anthropicConstructor = vi.fn(function AnthropicMock(
  this: { options?: unknown; messages: { create: typeof messagesCreateMock } },
  options: unknown
) {
  this.options = options
  this.messages = { create: messagesCreateMock }
})

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('ANTHROPIC_API_KEY', '')
  vi.stubEnv('AI_MODEL', '')
  vi.stubEnv('AI_MODEL_SMART', '')
  vi.stubEnv('AI_MODEL_FAST', '')
  vi.doMock('@anthropic-ai/sdk', () => ({ default: anthropicConstructor }))
  anthropicConstructor.mockClear()
  messagesCreateMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.doUnmock('@anthropic-ai/sdk')
})

function mockMessageResponse(payload: unknown) {
  messagesCreateMock.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    usage: { input_tokens: 100, output_tokens: 200 },
  })
}

describe('getAnthropicClient', () => {
  it('requires an API key', async () => {
    const { getAnthropicClient } = await import('@/lib/anthropic')

    expect(() => getAnthropicClient()).toThrow(/ANTHROPIC_API_KEY/)
  })

  it('configures the official SDK endpoint directly', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-api-key')

    const { getAnthropicClient } = await import('@/lib/anthropic')
    const client = getAnthropicClient()

    expect(anthropicConstructor).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      maxRetries: 2,
      timeout: 5 * 60 * 1000,
    })
    expect(getAnthropicClient()).toBe(client)
    expect(anthropicConstructor).toHaveBeenCalledTimes(1)
  })
})

describe('getAiModel', () => {
  it('defaults to the smart tier and returns built-in fallbacks when nothing is configured', async () => {
    const {
      DEFAULT_AI_MODEL_SMART,
      DEFAULT_AI_MODEL_FAST,
      getAiModel,
    } = await import('@/lib/anthropic')

    expect(getAiModel()).toBe(DEFAULT_AI_MODEL_SMART)
    expect(getAiModel('smart')).toBe(DEFAULT_AI_MODEL_SMART)
    expect(getAiModel('fast')).toBe(DEFAULT_AI_MODEL_FAST)
  })

  it('falls back to AI_MODEL for both tiers when only AI_MODEL is configured (backward compat)', async () => {
    vi.stubEnv('AI_MODEL', '  claude-custom-model  ')
    const { getAiModel } = await import('@/lib/anthropic')

    expect(getAiModel('smart')).toBe('claude-custom-model')
    expect(getAiModel('fast')).toBe('claude-custom-model')
  })

  it('prefers AI_MODEL_SMART over AI_MODEL for the smart tier', async () => {
    vi.stubEnv('AI_MODEL', 'claude-generic-model')
    vi.stubEnv('AI_MODEL_SMART', '  claude-smart-model  ')
    const { getAiModel } = await import('@/lib/anthropic')

    expect(getAiModel('smart')).toBe('claude-smart-model')
    // FAST tier still falls back to the generic AI_MODEL
    expect(getAiModel('fast')).toBe('claude-generic-model')
  })

  it('prefers AI_MODEL_FAST over AI_MODEL for the fast tier', async () => {
    vi.stubEnv('AI_MODEL', 'claude-generic-model')
    vi.stubEnv('AI_MODEL_FAST', '  claude-fast-model  ')
    const { getAiModel } = await import('@/lib/anthropic')

    expect(getAiModel('fast')).toBe('claude-fast-model')
    // SMART tier still falls back to the generic AI_MODEL
    expect(getAiModel('smart')).toBe('claude-generic-model')
  })

  it('uses AI_MODEL_SMART/AI_MODEL_FAST independently when both are configured', async () => {
    vi.stubEnv('AI_MODEL_SMART', 'claude-smart-model')
    vi.stubEnv('AI_MODEL_FAST', 'claude-fast-model')
    const { getAiModel } = await import('@/lib/anthropic')

    expect(getAiModel('smart')).toBe('claude-smart-model')
    expect(getAiModel('fast')).toBe('claude-fast-model')
  })
})

describe('getSmartModel / getFastModel', () => {
  it('are convenience wrappers around getAiModel(tier)', async () => {
    vi.stubEnv('AI_MODEL_SMART', 'claude-smart-model')
    vi.stubEnv('AI_MODEL_FAST', 'claude-fast-model')
    const { getSmartModel, getFastModel } = await import('@/lib/anthropic')

    expect(getSmartModel()).toBe('claude-smart-model')
    expect(getFastModel()).toBe('claude-fast-model')
  })
})

describe('calculateOverallScore', () => {
  it('returns the arithmetic average of all 5 scores, rounded and clamped', async () => {
    const { calculateOverallScore } = await import('@/lib/anthropic')

    // (8+7+9+6+5)/5 = 7
    expect(
      calculateOverallScore({
        dream_progress_score: 8,
        strategic_focus_score: 7,
        productivity_score: 9,
        life_balance_score: 6,
        discipline_score: 5,
      })
    ).toBe(7)

    // (9+9+9+9+8)/5 = 8.8 -> rounds to 9 via clampScore
    expect(
      calculateOverallScore({
        dream_progress_score: 9,
        strategic_focus_score: 9,
        productivity_score: 9,
        life_balance_score: 9,
        discipline_score: 8,
      })
    ).toBe(9)
  })

  it('clamps the result into the 1-10 range', async () => {
    const { calculateOverallScore } = await import('@/lib/anthropic')

    expect(
      calculateOverallScore({
        dream_progress_score: 1,
        strategic_focus_score: 1,
        productivity_score: 1,
        life_balance_score: 1,
        discipline_score: 1,
      })
    ).toBe(1)

    expect(
      calculateOverallScore({
        dream_progress_score: 10,
        strategic_focus_score: 10,
        productivity_score: 10,
        life_balance_score: 10,
        discipline_score: 10,
      })
    ).toBe(10)
  })
})

describe('evaluateDayNewWithUsage', () => {
  const baseRequest: DailyEvaluationRequest = {
    date: '2026-01-15',
    planText: 'Закрыть 2 стратегические задачи по проекту мечты',
    factText: 'Обе задачи закрыты, зарядка сделана',
    openTasks: [],
    goals: {
      dreamGoal: 'Построить успешный бизнес',
      yearGoals: ['Выйти на новый рынок'],
      halfYearGoals: [],
      quarterGoals: [],
      monthGoals: [],
      weekGoals: [],
    },
  }

  it('overrides overall_score with the server-computed average, ignoring the model value', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-api-key')

    // Модель специально возвращает "неправильный" overall_score (1),
    // чтобы убедиться что итоговое значение пересчитывается в коде
    mockMessageResponse({
      dream_progress_score: 8,
      strategic_focus_score: 7,
      productivity_score: 9,
      life_balance_score: 6,
      discipline_score: 5,
      overall_score: 1,
      plan_vs_fact: 'Выполнено 2/2 задачи',
      alignment: {
        day_to_week: 'работает',
        week_to_month: 'работает',
        month_to_quarter: 'работает',
        quarter_to_half: 'работает',
        half_to_year: 'работает',
        year_to_dream: 'работает',
      },
      balance_flags: { health: 'ok', family: 'ok', energy: 'ok' },
      feedback: {
        conclusion: 'День приблизил к мечте',
        worked: 'Стратегические задачи закрыты',
        blocks: 'Серьёзных блокеров не вижу',
      },
      recommendations: 'Продолжай в том же духе',
    })

    const { evaluateDayNewWithUsage, DEFAULT_AI_MODEL_FAST } = await import('@/lib/anthropic')
    const { result, usage } = await evaluateDayNewWithUsage(baseRequest)

    // (8+7+9+6+5)/5 = 7, а не 1 из ответа модели
    expect(result.overall_score).toBe(7)
    expect(result.dream_progress_score).toBe(8)

    // Оценка дня — задача уровня FAST
    expect(usage.model).toBe(DEFAULT_AI_MODEL_FAST)
  })
})

describe('evaluatePeriodWithUsage', () => {
  const baseRequest: PeriodEvaluationRequest = {
    periodType: 'month',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    days: [
      {
        date: '2026-01-01',
        planText: 'план',
        factText: 'факт',
        dreamProgressScore: 8,
        overallScore: 7,
        strategicFocusScore: 9,
        productivityScore: 6,
        lifeBalanceScore: 5,
        disciplineScore: 8,
      },
      {
        date: '2026-01-02',
        planText: 'план',
        factText: 'факт',
        dreamProgressScore: 6,
        overallScore: 5,
        strategicFocusScore: 5,
        productivityScore: 8,
        lifeBalanceScore: 7,
        disciplineScore: 6,
      },
    ],
    goals: {
      dreamGoal: 'Построить успешный бизнес',
      yearGoals: [],
      halfYearGoals: [],
      quarterGoals: [],
      monthGoals: [],
      weekGoals: [],
    },
  }

  it('overrides dreamProgressScore/overallScore with server-computed period averages', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-api-key')

    // Модель возвращает намеренно "неправильные" средние (1),
    // чтобы убедиться что итоговые значения считаются в коде
    mockMessageResponse({
      dreamProgressScore: 1,
      overallScore: 1,
      professionalBlock: { strategyAvg: 7, operationsAvg: 7, teamAvg: 7, analysis: 'ok' },
      personalBlock: { healthScore: 7, familyScore: 7, energyScore: 7, analysis: 'ok' },
      socialBlock: { teamworkScore: 7, analysis: 'недостаточно данных для точной оценки' },
      balanceBlock: { workLifeBalance: 6, riskOfBurnout: 'низкий', analysis: 'ok' },
      patterns: { bestDays: [], worstDays: [], productivityPattern: '', balanceIssues: [] },
      trends: {
        dreamProgressTrend: 'стабильно',
        overallTrend: 'стабильно',
        strategyTrend: 'стабильно',
        description: 'ok',
      },
      goalsCompletion: {
        totalGoals: 0,
        completedGoals: 0,
        inProgressGoals: 0,
        notStartedGoals: 0,
        completionRate: 0,
        analysis: 'ok',
      },
      alignment: 'ok',
      feedback: 'обратная связь',
      recommendations: 'рекомендации',
    })

    const { evaluatePeriodWithUsage, DEFAULT_AI_MODEL_SMART } = await import('@/lib/anthropic')
    const { result, usage } = await evaluatePeriodWithUsage(baseRequest)

    // dreamProgressScore avg (8+6)/2 = 7, overallScore avg (7+5)/2 = 6, не 1 из ответа модели
    expect(result.dreamProgressScore).toBe(7)
    expect(result.overallScore).toBe(6)

    // Оценка периода — задача уровня SMART
    expect(usage.model).toBe(DEFAULT_AI_MODEL_SMART)
  })
})

describe('generateForecastWithUsage', () => {
  const baseRequest: ForecastRequest = {
    basePeriodType: 'month',
    basePeriodStart: '2026-01-01',
    basePeriodEnd: '2026-01-31',
    baseDays: [
      {
        date: '2026-01-01',
        planText: 'план',
        factText: 'факт',
        dreamProgressScore: 7,
        overallScore: 7,
        strategicFocusScore: 7,
        productivityScore: 7,
        lifeBalanceScore: 7,
        disciplineScore: 7,
        tasksPlanned: 4,
        tasksCompleted: 2,
        strategicTasks: 2,
        strategicCompleted: 1,
      },
    ],
    forecastHorizon: 'quarter',
    horizonGoals: ['Цель 1'],
    dreamGoal: 'Построить успешный бизнес',
  }

  it('merges server-computed executionQuality numbers with model-provided patterns', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-api-key')

    mockMessageResponse({
      // Модель специально присылает "неправильные" числа — они должны быть
      // проигнорированы и заменены серверным расчетом
      executionQuality: {
        totalTasksPlanned: 999,
        completionRate: 999,
        patterns: ['паттерн от модели 1', 'паттерн от модели 2'],
      },
      behaviorPatterns: [],
      horizonType: 'Квартал',
      goalForecasts: [],
      overallProbability: 50,
      dreamForecast: {
        estimatedYears: 5,
        onTrack: true,
        progressPerYear: 20,
        requiredProgressPerYear: 20,
        gap: 0,
        adjustmentNeeded: 'ничего',
      },
      whatIfScenarios: [],
      keyRecommendations: [],
      criticalRisks: [],
      summary: 'Итоговое резюме прогноза',
    })

    const { generateForecastWithUsage, DEFAULT_AI_MODEL_SMART } = await import('@/lib/anthropic')
    const { result, usage } = await generateForecastWithUsage(baseRequest)

    // Числа взяты из серверного расчета (4 задачи, 2 выполнено = 50%), а не 999 от модели
    expect(result.executionQuality.totalTasksPlanned).toBe(4)
    expect(result.executionQuality.totalTasksCompleted).toBe(2)
    expect(result.executionQuality.completionRate).toBe(50)
    // patterns взяты из ответа модели
    expect(result.executionQuality.patterns).toEqual([
      'паттерн от модели 1',
      'паттерн от модели 2',
    ])

    // Прогноз — задача уровня SMART
    expect(usage.model).toBe(DEFAULT_AI_MODEL_SMART)
  })
})

describe('updateUserInsights', () => {
  it('calls the FAST model tier and normalizes the response', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-api-key')

    mockMessageResponse({
      profile: {
        patterns: 'Обычно выполняет утренние задачи первыми',
        strengths: 'Дисциплина',
        challenges: 'Прокрастинация вечером',
        preferences: 'Короткие задачи',
        recommendations: 'Планировать сложное на утро',
        motivators: 'Прогресс к мечте',
      },
      entries: [
        { category: 'pattern', text: 'Закрыл задачи до обеда' },
      ],
    })

    const { updateUserInsights, DEFAULT_AI_MODEL_FAST } = await import('@/lib/anthropic')
    const result = await updateUserInsights({
      currentInsights: null,
      evaluationCount: 3,
      planText: 'план',
      factText: 'факт',
      evaluationFeedback: 'обратная связь',
      dreamProgressScore: 7,
      overallScore: 8,
      date: '2026-01-15',
    })

    expect(result.profile.patterns).toBe('Обычно выполняет утренние задачи первыми')
    expect(result.entries).toHaveLength(1)
    expect(messagesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: DEFAULT_AI_MODEL_FAST })
    )
  })
})
