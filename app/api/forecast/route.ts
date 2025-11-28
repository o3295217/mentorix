import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateForecast } from '@/lib/anthropic'
import { ForecastRequest, DayData } from '@/lib/prompts/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      forecastType,
      periodType,
      periodStart,
      periodEnd,
      historicalDays = 30,
    } = body

    if (!forecastType) {
      return NextResponse.json(
        { error: 'forecastType is required' },
        { status: 400 }
      )
    }

    // Получить мечту
    const dream = await prisma.dreamGoal.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    if (!dream) {
      return NextResponse.json(
        { error: 'Dream goal not found. Please set your dream first.' },
        { status: 404 }
      )
    }

    // Определить период для загрузки исторических данных
    const endDate = periodEnd ? new Date(periodEnd) : new Date()
    const startDate = periodStart
      ? new Date(periodStart)
      : new Date(endDate.getTime() - historicalDays * 24 * 60 * 60 * 1000)

    // Получить все дневные записи с оценками за исторический период
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

    // Фильтруем только дни с оценками
    const daysWithEvaluations = dailyEntries.filter((entry) => entry.evaluation)

    if (daysWithEvaluations.length === 0) {
      return NextResponse.json(
        { error: 'No evaluations found for historical analysis. Please evaluate some days first.' },
        { status: 404 }
      )
    }

    // Подготовить данные дней для прогноза
    const historicalDaysData: DayData[] = daysWithEvaluations.map((entry) => ({
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

    // Получить цели текущего периода (если указаны)
    let currentPeriodGoals: string[] = []
    if (periodType && periodStart) {
      const periodStartDate = new Date(periodStart)

      if (periodType === 'week') {
        const weekGoal = await prisma.periodGoal.findFirst({
          where: { periodType: 'week', periodStart: periodStartDate },
          orderBy: { createdAt: 'desc' },
        })
        if (weekGoal) {
          currentPeriodGoals = JSON.parse(weekGoal.goalsJson)
        }
      } else if (periodType === 'month') {
        const monthGoal = await prisma.periodGoal.findFirst({
          where: { periodType: 'month', periodStart: periodStartDate },
          orderBy: { createdAt: 'desc' },
        })
        if (monthGoal) {
          currentPeriodGoals = JSON.parse(monthGoal.goalsJson)
        }
      } else if (periodType === 'quarter') {
        const quarterGoal = await prisma.periodGoal.findFirst({
          where: { periodType: 'quarter', periodStart: periodStartDate },
          orderBy: { createdAt: 'desc' },
        })
        if (quarterGoal) {
          currentPeriodGoals = JSON.parse(quarterGoal.goalsJson)
        }
      } else if (periodType === 'year') {
        const year = periodStartDate.getFullYear()
        const yearGoal = await prisma.yearGoal.findUnique({
          where: { year },
        })
        if (yearGoal) {
          currentPeriodGoals = JSON.parse(yearGoal.goalsJson)
        }
      }
    }

    // Получить профиль пользователя
    const userProfile = await prisma.userProfile.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    // Подготовить запрос для прогноза
    const forecastRequest: ForecastRequest = {
      forecastType: forecastType,
      periodType: periodType || undefined,
      historicalDays: historicalDaysData,
      currentPeriodGoals: currentPeriodGoals.length > 0 ? currentPeriodGoals : undefined,
      dreamGoal: dream.goalText,
      dreamYears: dream.years,
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

    // Вызвать Claude API для прогноза
    const forecastResponse = await generateForecast(forecastRequest)

    return NextResponse.json({
      forecast: forecastResponse,
      metadata: {
        historicalDaysCount: historicalDaysData.length,
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
        dreamGoal: dream.goalText,
        dreamYears: dream.years,
      },
    })
  } catch (error) {
    console.error('Error generating forecast:', error)
    return NextResponse.json(
      { error: 'Failed to generate forecast', details: String(error) },
      { status: 500 }
    )
  }
}
