import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { evaluatePeriod } from '@/lib/anthropic'
import { PeriodEvaluationRequest, DayData } from '@/lib/prompts/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { periodType, periodStart, periodEnd } = body

    if (!periodType || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'periodType, periodStart, and periodEnd are required' },
        { status: 400 }
      )
    }

    const startDate = new Date(periodStart)
    const endDate = new Date(periodEnd)

    // Получить все дневные записи за период
    const dailyEntries = await prisma.dailyEntry.findMany({
      where: {
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
      orderBy: { createdAt: 'desc' },
    })

    // Получить цели для периода
    const year = startDate.getFullYear()
    const [currentYearGoal, halfYearGoals, quarterGoals, monthGoals, weekGoals] =
      await Promise.all([
        prisma.yearGoal.findUnique({
          where: { year },
        }),
        prisma.periodGoal.findFirst({
          where: { periodType: 'half_year', periodStart: { lte: startDate } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.periodGoal.findFirst({
          where: { periodType: 'quarter', periodStart: { lte: startDate } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.periodGoal.findFirst({
          where: { periodType: 'month', periodStart: { lte: startDate } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.periodGoal.findFirst({
          where: { periodType: 'week', periodStart: { lte: startDate } },
          orderBy: { createdAt: 'desc' },
        }),
      ])

    // Получить профиль пользователя
    const userProfile = await prisma.userProfile.findFirst({
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
        yearGoals: currentYearGoal ? JSON.parse(currentYearGoal.goalsJson) : [],
        halfYearGoals: halfYearGoals ? JSON.parse(halfYearGoals.goalsJson) : [],
        quarterGoals: quarterGoals ? JSON.parse(quarterGoals.goalsJson) : [],
        monthGoals: monthGoals ? JSON.parse(monthGoals.goalsJson) : [],
        weekGoals: weekGoals ? JSON.parse(weekGoals.goalsJson) : [],
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
    console.error('Error evaluating period:', error)
    return NextResponse.json(
      { error: 'Failed to evaluate period', details: String(error) },
      { status: 500 }
    )
  }
}
