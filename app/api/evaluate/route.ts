import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { evaluateDayNew } from '@/lib/anthropic'
import { DailyEvaluationRequest } from '@/lib/prompts/types'
import { getPeriodDates } from '@/lib/dates'

// Безопасный парсинг JSON с fallback значением
function safeParseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback
  try {
    return JSON.parse(json)
  } catch (e) {
    console.error('Failed to parse JSON:', json)
    return fallback
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { dailyEntryId } = body

    if (!dailyEntryId) {
      return NextResponse.json({ error: 'dailyEntryId is required' }, { status: 400 })
    }

    // Получить daily entry
    const dailyEntry = await prisma.dailyEntry.findUnique({
      where: { id: dailyEntryId },
    })

    if (!dailyEntry) {
      return NextResponse.json({ error: 'Daily entry not found' }, { status: 404 })
    }

    if (!dailyEntry.factText) {
      return NextResponse.json(
        { error: 'Fact text is required for evaluation' },
        { status: 400 }
      )
    }

    // Получить мечту
    const dream = await prisma.dreamGoal.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    // Получить все цели из новой иерархической структуры
    const date = dailyEntry.date
    const year = date.getFullYear()

    // Периоды для загрузки из period_goals
    const yearPeriod = getPeriodDates(date, 'year')
    const halfYearPeriod = getPeriodDates(date, 'half_year')
    const quarterPeriod = getPeriodDates(date, 'quarter')
    const monthPeriod = getPeriodDates(date, 'month')
    const weekPeriod = getPeriodDates(date, 'week')

    const [currentYearGoal, halfYearGoals, quarterGoals, monthGoals, weekGoals] =
      await Promise.all([
        // Загружаем цели на год из year_goals
        prisma.yearGoal.findUnique({
          where: { year },
        }),
        // Остальные цели из period_goals (как раньше)
        prisma.periodGoal.findFirst({
          where: { periodType: 'half_year', periodStart: halfYearPeriod.start },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.periodGoal.findFirst({
          where: { periodType: 'quarter', periodStart: quarterPeriod.start },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.periodGoal.findFirst({
          where: { periodType: 'month', periodStart: monthPeriod.start },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.periodGoal.findFirst({
          where: { periodType: 'week', periodStart: weekPeriod.start },
          orderBy: { createdAt: 'desc' },
        }),
      ])

    // Получить незакрытые задачи
    const openTasks = await prisma.openTask.findMany({
      where: { isClosed: false },
    })

    // Получить профиль пользователя
    const userProfile = await prisma.userProfile.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    // Подготовить запрос для оценки (ОБНОВЛЕННЫЙ ФОРМАТ)
    const evaluationRequest: DailyEvaluationRequest = {
      date: date.toLocaleDateString('ru-RU'),
      planText: dailyEntry.planText || '',
      factText: dailyEntry.factText || '',
      goals: {
        dreamGoal: dream?.goalText || 'Не указана',
        // Цели на год теперь из year_goals таблицы
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
      context: {
        emotionalState: dailyEntry.emotionalState || undefined,
        physicalState: dailyEntry.physicalState || undefined,
        lifeEvents: dailyEntry.lifeEvents || undefined,
        externalFactors: dailyEntry.externalFactors || undefined,
        energyLevel: dailyEntry.energyLevel || undefined,
        sleepQuality: dailyEntry.sleepQuality || undefined,
        familyTime: dailyEntry.familyTime || undefined,
        exerciseTime: dailyEntry.exerciseTime || undefined,
      },
      openTasks: openTasks.map((t) => `[${t.taskType}] ${t.taskText}`),
    }

    // Вызвать Claude API (НОВАЯ ФУНКЦИЯ)
    const evaluationResponse = await evaluateDayNew(evaluationRequest)

    // Подготовить данные для сохранения (DRY - не дублируем в create/update)
    const evaluationData = {
      dreamProgressScore: evaluationResponse.dream_progress_score,
      strategyScore: evaluationResponse.strategy_score,
      operationsScore: evaluationResponse.operations_score,
      teamScore: evaluationResponse.team_score,
      efficiencyScore: evaluationResponse.efficiency_score,
      overallScore: evaluationResponse.overall_score,
      feedbackText: evaluationResponse.feedback,
      planVsFactText: evaluationResponse.plan_vs_fact,
      alignmentDayWeek: evaluationResponse.alignment.day_to_week,
      alignmentWeekMonth: evaluationResponse.alignment.week_to_month,
      alignmentMonthQuarter: evaluationResponse.alignment.month_to_quarter,
      alignmentQuarterHalf: evaluationResponse.alignment.quarter_to_half,
      alignmentHalfYear: evaluationResponse.alignment.half_to_year,
      alignmentYearDream: evaluationResponse.alignment.year_to_dream,
      recommendationsText: evaluationResponse.recommendations,
      // Флаги баланса
      healthFlag: evaluationResponse.balance_flags.health,
      familyFlag: evaluationResponse.balance_flags.family,
      energyFlag: evaluationResponse.balance_flags.energy,
      // Горизонтальный alignment
      workHealthAlignment: evaluationResponse.horizontal_alignment?.work_health,
      workFamilyAlignment: evaluationResponse.horizontal_alignment?.work_family,
      workValuesAlignment: evaluationResponse.horizontal_alignment?.work_values,
      // Предложенные задачи
      suggestedTasksJson: evaluationResponse.suggested_tasks
        ? JSON.stringify(evaluationResponse.suggested_tasks)
        : null,
    }

    // Сохранить или обновить оценку (upsert для повторных оценок)
    const evaluation = await prisma.evaluation.upsert({
      where: { dailyEntryId },
      create: { dailyEntryId, ...evaluationData },
      update: evaluationData,
    })

    return NextResponse.json(evaluation)
  } catch (error) {
    console.error('Error evaluating day:', error)
    return NextResponse.json(
      { error: 'Failed to evaluate day', details: String(error) },
      { status: 500 }
    )
  }
}
