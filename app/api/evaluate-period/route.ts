import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { evaluatePeriodWithUsage } from '@/lib/anthropic'
import { logAIUsage } from '@/lib/ai-usage'
import { PeriodEvaluationRequest, DayData } from '@/lib/prompts/types'
import { parseDateParam, validateAiDateRange } from '@/lib/dates'
import { ApiErrors } from '@/lib/api-utils'
import { requireUserId } from '@/lib/get-user-id'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import { getPeriodEvaluationUserContext } from '@/lib/user-context'
import { z } from 'zod'

const PeriodEvaluationSchema = z.object({
  periodType: z.enum(['week', 'month', 'quarter', 'year', 'custom']),
  periodStart: z.string().trim().min(1).max(32),
  periodEnd: z.string().trim().min(1).max(32),
})

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const rateLimit = checkRateLimit(userId, rateLimiters.ai)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before evaluating another period.', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const validation = PeriodEvaluationSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { periodType, periodStart, periodEnd } = validation.data

    const startDate = parseDateParam(periodStart)
    const endDate = parseDateParam(periodEnd)
    const rangeValidation = validateAiDateRange({
      periodType,
      startDate,
      endDate,
      label: 'Period',
    })
    if (!rangeValidation.success) {
      return NextResponse.json({ error: rangeValidation.error }, { status: 400 })
    }

    // Получить все дневные записи за период
    const dailyEntries = await prisma.dailyEntry.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        evaluation: true,
      },
      orderBy: {
        date: 'asc',
      },
    })

    if (dailyEntries.length === 0) {
      return NextResponse.json(
        { error: 'No daily entries found for this period' },
        { status: 404 }
      )
    }

    // Фильтруем только дни с оценками
    const daysWithEvaluations = dailyEntries.filter((entry) => entry.evaluation)

    console.log('[Period Evaluation] Request summary:', {
      periodType,
      totalDays: dailyEntries.length,
      daysWithEvaluations: daysWithEvaluations.length,
    })

    if (daysWithEvaluations.length === 0) {
      return NextResponse.json(
        { error: 'No evaluations found for this period. Please evaluate individual days first.' },
        { status: 404 }
      )
    }

    const userContext = await getPeriodEvaluationUserContext(userId, startDate)

    // Подготовить данные дней для оценки
    const daysData: DayData[] = daysWithEvaluations.map((entry) => ({
      date: entry.date.toLocaleDateString('ru-RU'),
      planText: entry.planText || '',
      factText: entry.factText || '',
      dreamProgressScore: entry.evaluation!.dreamProgressScore,
      overallScore: entry.evaluation!.overallScore,
      strategicFocusScore: entry.evaluation!.strategicFocusScore,
      productivityScore: entry.evaluation!.productivityScore,
      lifeBalanceScore: entry.evaluation!.lifeBalanceScore,
      disciplineScore: entry.evaluation!.disciplineScore,
      healthFlag: entry.evaluation!.healthFlag || undefined,
      familyFlag: entry.evaluation!.familyFlag || undefined,
      energyFlag: entry.evaluation!.energyFlag || undefined,
    }))

    // Подготовить запрос для оценки периода
    const evaluationRequest: PeriodEvaluationRequest = {
      periodType: periodType,
      periodStart: startDate.toLocaleDateString('ru-RU'),
      periodEnd: endDate.toLocaleDateString('ru-RU'),
      days: daysData,
      goals: userContext.goals,
      userProfile: userContext.profile,
    }

    // Вызвать Claude API для периодической оценки
    const { result: evaluationResponse, usage } = await evaluatePeriodWithUsage(evaluationRequest)

    await logAIUsage({
      userId,
      endpoint: 'evaluate-period',
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      durationMs: usage.durationMs,
      success: true,
    })

    // Сохранить периодическую оценку
    const periodEvaluation = await prisma.periodEvaluation.create({
      data: {
        userId,
        periodType,
        periodStart: startDate,
        periodEnd: endDate,
        dreamProgressScore: evaluationResponse.dreamProgressScore,
        overallScore: evaluationResponse.overallScore,
        professionalBlock: JSON.stringify(evaluationResponse.professionalBlock),
        personalBlock: JSON.stringify(evaluationResponse.personalBlock),
        socialBlock: JSON.stringify(evaluationResponse.socialBlock),
        balanceBlock: JSON.stringify(evaluationResponse.balanceBlock),
        patterns: JSON.stringify(evaluationResponse.patterns),
        trends: JSON.stringify(evaluationResponse.trends),
        goalsCompletion: JSON.stringify(evaluationResponse.goalsCompletion),
        alignment: evaluationResponse.alignment,
        blockers: evaluationResponse.blockers
          ? JSON.stringify(evaluationResponse.blockers)
          : null,
        feedbackText: evaluationResponse.feedback,
        recommendationsText: Array.isArray(evaluationResponse.recommendations)
          ? evaluationResponse.recommendations.join('\n')
          : evaluationResponse.recommendations,
        insights: evaluationResponse.insights || null,
      },
    })

    return NextResponse.json(periodEvaluation)
  } catch (error) {
    return ApiErrors.serverError('Failed to evaluate period', error)
  }
}
