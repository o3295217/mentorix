import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { evaluatePeriod } from '@/lib/anthropic'
import { PeriodEvaluationRequest, DayData } from '@/lib/prompts/types'
import { parseDateParam } from '@/lib/dates'
import { ApiErrors, safeParseJson } from '@/lib/api-utils'
import { requireUserId } from '@/lib/get-user-id'

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    const { periodType, periodStart, periodEnd } = body

    if (!periodType || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'periodType, periodStart, and periodEnd are required' },
        { status: 400 }
      )
    }

    const startDate = parseDateParam(periodStart)
    const endDate = parseDateParam(periodEnd)

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

    console.log(`Period evaluation: ${dailyEntries.length} total days, ${daysWithEvaluations.length} with evaluations`)

    if (daysWithEvaluations.length === 0) {
      return NextResponse.json(
        { error: 'No evaluations found for this period. Please evaluate individual days first.' },
        { status: 404 }
      )
    }

    // Получить мечту
    const dream = await prisma.dreamGoal.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    // Получить цели для периода
    const year = startDate.getFullYear()
    const [currentYearGoal, halfYearGoals, quarterGoals, monthGoals, weekGoals] =
      await Promise.all([
        prisma.yearGoal.findFirst({
          where: { userId, year },
        }),
        prisma.periodGoal.findFirst({
          where: { userId, periodType: 'half_year', periodStart: { lte: startDate } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.periodGoal.findFirst({
          where: { userId, periodType: 'quarter', periodStart: { lte: startDate } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.periodGoal.findFirst({
          where: { userId, periodType: 'month', periodStart: { lte: startDate } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.periodGoal.findFirst({
          where: { userId, periodType: 'week', periodStart: { lte: startDate } },
          orderBy: { createdAt: 'desc' },
        }),
      ])

    // Получить профиль пользователя
    const userProfile = await prisma.userProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    // Подготовить данные дней для оценки
    const daysData: DayData[] = daysWithEvaluations.map((entry) => ({
      date: entry.date.toLocaleDateString('ru-RU'),
      planText: entry.planText || '',
      factText: entry.factText || '',
      dreamProgressScore: entry.evaluation!.dreamProgressScore,
      overallScore: entry.evaluation!.overallScore,
      strategyScore: entry.evaluation!.strategyScore,
      operationsScore: entry.evaluation!.operationsScore,
      teamScore: entry.evaluation!.teamScore,
      efficiencyScore: entry.evaluation!.efficiencyScore,
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
      goals: {
        dreamGoal: dream?.goalText || 'Не указана',
        dreamYears: dream?.months ? Math.ceil(dream.months / 12) : undefined,
        dreamMonths: dream?.months || undefined,
        yearGoals: safeParseJson(currentYearGoal?.goalsJson, []),
        halfYearGoals: safeParseJson(halfYearGoals?.goalsJson, []),
        quarterGoals: safeParseJson(quarterGoals?.goalsJson, []),
        monthGoals: safeParseJson(monthGoals?.goalsJson, []),
        weekGoals: safeParseJson(weekGoals?.goalsJson, []),
      },
      userProfile: userProfile
        ? {
            name: userProfile.name || undefined,
            occupation: userProfile.occupation || undefined,
            industry: userProfile.industry || undefined,
            maritalStatus: userProfile.maritalStatus || undefined,
            hobbies: userProfile.hobbies || undefined,
            sports: userProfile.sports || undefined,
            location: userProfile.location || undefined,
            age: userProfile.age || undefined,
            education: userProfile.education || undefined,
            teamSize: userProfile.teamSize || undefined,
            workExperience: userProfile.workExperience || undefined,
            values: userProfile.values || undefined,
            challenges: userProfile.challenges || undefined,
            other: userProfile.other || undefined,
          }
        : undefined,
    }

    // Вызвать Claude API для периодической оценки
    console.log('Calling Claude API for period evaluation...')
    const evaluationResponse = await evaluatePeriod(evaluationRequest)
    console.log('Claude API response received')

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
