import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateForecast } from '@/lib/anthropic'
import { ForecastRequest, DayDataFull } from '@/lib/prompts/types'
import { parseDateParam } from '@/lib/dates'
import { buildFactFromSelection } from '@/lib/fact-utils'
import { ApiErrors, safeParseJson } from '@/lib/api-utils'
import { requireUserId } from '@/lib/get-user-id'

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
    const body = await request.json()
    const {
      // База для анализа (прошлое)
      basePeriodType,
      basePeriodStart,
      basePeriodEnd,
      // Горизонт прогноза (будущее)
      forecastHorizon,
      horizonStart,
      horizonEnd,
    } = body

    if (!basePeriodType || !basePeriodStart || !basePeriodEnd) {
      return NextResponse.json(
        { error: 'basePeriodType, basePeriodStart and basePeriodEnd are required' },
        { status: 400 }
      )
    }

    if (!forecastHorizon) {
      return NextResponse.json(
        { error: 'forecastHorizon is required' },
        { status: 400 }
      )
    }

    // Получить мечту
    const dream = await prisma.dreamGoal.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    if (!dream) {
      return NextResponse.json(
        { error: 'Dream goal not found. Please set your dream first.' },
        { status: 404 }
      )
    }

    // === ЗАГРУЗКА ДАННЫХ БАЗОВОГО ПЕРИОДА ===
    const baseStart = parseDateParam(basePeriodStart)
    const baseEnd = parseDateParam(basePeriodEnd)

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

    // === ЗАГРУЗКА ЦЕЛЕЙ ГОРИЗОНТА ===
    let horizonGoals: string[] = []
    let horizonStartDate: Date | undefined

    if (forecastHorizon === 'dream') {
      // Для мечты берем годовые цели
      const currentYear = new Date().getFullYear()
      const yearGoal = await prisma.yearGoal.findFirst({
        where: { userId, year: currentYear },
      })
      if (yearGoal) {
        horizonGoals = safeParseJson(yearGoal.goalsJson, [])
      }
    } else if (horizonStart && horizonEnd) {
      horizonStartDate = parseDateParam(horizonStart)

      if (forecastHorizon === 'week') {
        const weekGoal = await prisma.periodGoal.findFirst({
          where: { userId, periodType: 'week', periodStart: horizonStartDate },
          orderBy: { createdAt: 'desc' },
        })
        if (weekGoal) {
          horizonGoals = safeParseJson(weekGoal.goalsJson, [])
        }
      } else if (forecastHorizon === 'month') {
        const monthGoal = await prisma.periodGoal.findFirst({
          where: { userId, periodType: 'month', periodStart: horizonStartDate },
          orderBy: { createdAt: 'desc' },
        })
        if (monthGoal) {
          horizonGoals = safeParseJson(monthGoal.goalsJson, [])
        }
      } else if (forecastHorizon === 'quarter') {
        const quarterGoal = await prisma.periodGoal.findFirst({
          where: { userId, periodType: 'quarter', periodStart: horizonStartDate },
          orderBy: { createdAt: 'desc' },
        })
        if (quarterGoal) {
          horizonGoals = safeParseJson(quarterGoal.goalsJson, [])
        }
      } else if (forecastHorizon === 'year') {
        const year = horizonStartDate.getFullYear()
        const yearGoal = await prisma.yearGoal.findFirst({
          where: { userId, year },
        })
        if (yearGoal) {
          horizonGoals = safeParseJson(yearGoal.goalsJson, [])
        }
      }
    }

    // Получить профиль пользователя
    const userProfile = await prisma.userProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

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
    const statusCode = (error as any)?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    return ApiErrors.serverError('Failed to generate forecast', error)
  }
}
