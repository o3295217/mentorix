import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateForecastWithUsage } from '@/lib/anthropic'
import { logAIUsage } from '@/lib/ai-usage'
import { ForecastRequest, DayDataFull } from '@/lib/prompts/types'
import { parseDateParam, validateAiDateRange } from '@/lib/dates'
import { buildFactFromSelection } from '@/lib/fact-utils'
import { ApiErrors } from '@/lib/api-utils'
import { requireUserId } from '@/lib/get-user-id'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import { getForecastHorizonGoals, getLatestDreamGoal, getLatestUserProfile } from '@/lib/user-context'
import { z } from 'zod'

const ForecastSchema = z.object({
  basePeriodType: z.enum(['week', 'month', 'quarter', 'year', 'custom']),
  basePeriodStart: z.string().trim().min(1).max(32),
  basePeriodEnd: z.string().trim().min(1).max(32),
  forecastHorizon: z.enum(['week', 'month', 'quarter', 'year', 'dream']),
  horizonStart: z.string().trim().min(1).max(32).optional(),
  horizonEnd: z.string().trim().min(1).max(32).optional(),
}).refine((data) => data.forecastHorizon === 'dream' || (!!data.horizonStart && !!data.horizonEnd), {
  message: 'horizonStart and horizonEnd are required unless forecastHorizon is dream',
  path: ['horizonStart'],
})

// Подсчет задач в тексте плана/факта
function countTasks(text: string): { total: number; strategic: number } {
  if (!text) return { total: 0, strategic: 0 }
  
  // Считаем строки, которые выглядят как задачи (начинаются с -, *, •, числа или чекбокса)
  const lines = text.split('\n').filter(line => {
    const trimmed = line.trim()
    return (
      trimmed.startsWith('-') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('•') ||
      trimmed.startsWith('☐') ||
      trimmed.startsWith('☑') ||
      trimmed.startsWith('✓') ||
      trimmed.startsWith('✗') ||
      /^\d+[.)]/.test(trimmed)
    )
  })
  
  // Стратегические задачи содержат ключевые слова
  const strategicKeywords = [
    'стратег', 'развити', 'проект', 'запуск', 'внедр', 'создан', 
    'разработ', 'планиров', 'анализ', 'исследован', 'обучен',
    'партнер', 'инвест', 'масштаб', 'оптимиз', 'автоматиз'
  ]
  
  const strategic = lines.filter(line => 
    strategicKeywords.some(kw => line.toLowerCase().includes(kw))
  ).length
  
  return { total: lines.length, strategic }
}

// Подсчет выполненных задач в факте относительно плана
function countCompletedTasks(planText: string, factText: string): { completed: number; strategicCompleted: number } {
  const planTasks = countTasks(planText)
  const factTasks = countTasks(factText)
  
  // Упрощенная логика: считаем что выполнено столько задач, сколько упомянуто в факте
  // (не больше чем было в плане)
  return {
    completed: Math.min(factTasks.total, planTasks.total),
    strategicCompleted: Math.min(factTasks.strategic, planTasks.strategic)
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const rateLimit = checkRateLimit(userId, rateLimiters.ai)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before generating another forecast.', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const validation = ForecastSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const {
      basePeriodType,
      basePeriodStart,
      basePeriodEnd,
      forecastHorizon,
      horizonStart,
      horizonEnd,
    } = validation.data

    const baseStart = parseDateParam(basePeriodStart)
    const baseEnd = parseDateParam(basePeriodEnd)
    const baseRangeValidation = validateAiDateRange({
      periodType: basePeriodType,
      startDate: baseStart,
      endDate: baseEnd,
      label: 'Base period',
    })
    if (!baseRangeValidation.success) {
      return NextResponse.json({ error: baseRangeValidation.error }, { status: 400 })
    }

    let horizonStartDate: Date | undefined
    if (forecastHorizon !== 'dream' && horizonStart && horizonEnd) {
      horizonStartDate = parseDateParam(horizonStart)
      const horizonEndDate = parseDateParam(horizonEnd)
      const horizonRangeValidation = validateAiDateRange({
        periodType: forecastHorizon,
        startDate: horizonStartDate,
        endDate: horizonEndDate,
        label: 'Forecast horizon',
      })
      if (!horizonRangeValidation.success) {
        return NextResponse.json({ error: horizonRangeValidation.error }, { status: 400 })
      }
    }

    const dream = await getLatestDreamGoal(userId)

    if (!dream) {
      return NextResponse.json(
        { error: 'Dream goal not found. Please set your dream first.' },
        { status: 404 }
      )
    }

    // === ЗАГРУЗКА ДАННЫХ БАЗОВОГО ПЕРИОДА ===
    const dailyEntries = await prisma.dailyEntry.findMany({
      where: {
        userId,
        date: {
          gte: baseStart,
          lte: baseEnd,
        },
      },
      include: {
        evaluation: true,
      },
      orderBy: {
        date: 'asc',
      },
    })

    // Фильтруем только дни с оценками
    const daysWithEvaluations = dailyEntries.filter((entry) => entry.evaluation)

    if (daysWithEvaluations.length === 0) {
      return NextResponse.json(
        { error: 'No evaluations found for base period. Please evaluate some days first.' },
        { status: 404 }
      )
    }

    // Подготовить данные дней с полным анализом план/факт
    const baseDays: DayDataFull[] = daysWithEvaluations.map((entry) => {
      const derived = buildFactFromSelection({
        planText: entry.planText,
        factText: entry.factText,
        selectedTasksJson: entry.selectedTasksJson,
      })

      const planTasks = countTasks(entry.planText || '')
      const completed = countCompletedTasks(entry.planText || '', derived.factText)
      
      return {
        date: entry.date.toLocaleDateString('ru-RU'),
        planText: entry.planText || '',
        factText: derived.factText,
        dreamProgressScore: entry.evaluation!.dreamProgressScore,
        overallScore: entry.evaluation!.overallScore,
        strategicFocusScore: entry.evaluation!.strategicFocusScore,
        productivityScore: entry.evaluation!.productivityScore,
        lifeBalanceScore: entry.evaluation!.lifeBalanceScore,
        disciplineScore: entry.evaluation!.disciplineScore,
        healthFlag: entry.evaluation!.healthFlag || undefined,
        familyFlag: entry.evaluation!.familyFlag || undefined,
        energyFlag: entry.evaluation!.energyFlag || undefined,
        // Новые поля для анализа задач
        tasksPlanned: planTasks.total,
        tasksCompleted: Math.max(completed.completed, derived.completedTasks.length),
        strategicTasks: planTasks.strategic,
        strategicCompleted: completed.strategicCompleted,
      }
    })

    const [horizonGoals, userProfile] = await Promise.all([
      getForecastHorizonGoals({ userId, forecastHorizon, horizonStartDate }),
      getLatestUserProfile(userId),
    ])

    // Подготовить запрос для прогноза (НОВАЯ СТРУКТУРА)
    const forecastRequest: ForecastRequest = {
      // База для анализа
      basePeriodType: basePeriodType,
      basePeriodStart: basePeriodStart,
      basePeriodEnd: basePeriodEnd,
      baseDays: baseDays,
      // Горизонт прогноза
      forecastHorizon: forecastHorizon,
      horizonGoals: horizonGoals,
      horizonStart: horizonStart,
      horizonEnd: horizonEnd,
      // Контекст
      dreamGoal: dream.goalText,
      dreamYears: dream.months ? Math.ceil(dream.months / 12) : undefined,
      dreamMonths: dream.months || undefined,
      userProfile,
    }

    // Вызвать Claude API для прогноза
    const { result: forecastResponse, usage } = await generateForecastWithUsage(forecastRequest)

    await logAIUsage({
      userId,
      endpoint: 'forecast',
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      durationMs: usage.durationMs,
      success: true,
    })

    return NextResponse.json({
      forecast: forecastResponse,
      metadata: {
        basePeriod: {
          type: basePeriodType,
          start: basePeriodStart,
          end: basePeriodEnd,
          daysCount: baseDays.length,
        },
        horizon: {
          type: forecastHorizon,
          start: horizonStart,
          end: horizonEnd,
          goalsCount: horizonGoals.length,
        },
        dream: {
          goal: dream.goalText,
          months: dream.months,
        },
      },
    })
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    return ApiErrors.serverError('Failed to generate forecast', error)
  }
}
