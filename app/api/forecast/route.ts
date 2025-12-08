import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateForecast } from '@/lib/anthropic'
import { ForecastRequest, DayDataFull } from '@/lib/prompts/types'

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
      /^\d+[\.\)]/.test(trimmed)
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
      orderBy: { createdAt: 'desc' },
    })

    if (!dream) {
      return NextResponse.json(
        { error: 'Dream goal not found. Please set your dream first.' },
        { status: 404 }
      )
    }

    // === ЗАГРУЗКА ДАННЫХ БАЗОВОГО ПЕРИОДА ===
    const baseStart = new Date(basePeriodStart)
    const baseEnd = new Date(basePeriodEnd)

    const dailyEntries = await prisma.dailyEntry.findMany({
      where: {
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
      const planTasks = countTasks(entry.planText || '')
      const completed = countCompletedTasks(entry.planText || '', entry.factText || '')
      
      return {
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
        // Новые поля для анализа задач
        tasksPlanned: planTasks.total,
        tasksCompleted: completed.completed,
        strategicTasks: planTasks.strategic,
        strategicCompleted: completed.strategicCompleted,
      }
    })

    // === ЗАГРУЗКА ЦЕЛЕЙ ГОРИЗОНТА ===
    let horizonGoals: string[] = []
    let horizonStartDate: Date | undefined
    let horizonEndDate: Date | undefined

    if (forecastHorizon === 'dream') {
      // Для мечты берем годовые цели
      const currentYear = new Date().getFullYear()
      const yearGoal = await prisma.yearGoal.findUnique({
        where: { year: currentYear },
      })
      if (yearGoal) {
        horizonGoals = safeParseJson(yearGoal.goalsJson, [])
      }
    } else if (horizonStart && horizonEnd) {
      horizonStartDate = new Date(horizonStart)
      horizonEndDate = new Date(horizonEnd)

      if (forecastHorizon === 'week') {
        const weekGoal = await prisma.periodGoal.findFirst({
          where: { periodType: 'week', periodStart: horizonStartDate },
          orderBy: { createdAt: 'desc' },
        })
        if (weekGoal) {
          horizonGoals = safeParseJson(weekGoal.goalsJson, [])
        }
      } else if (forecastHorizon === 'month') {
        const monthGoal = await prisma.periodGoal.findFirst({
          where: { periodType: 'month', periodStart: horizonStartDate },
          orderBy: { createdAt: 'desc' },
        })
        if (monthGoal) {
          horizonGoals = safeParseJson(monthGoal.goalsJson, [])
        }
      } else if (forecastHorizon === 'quarter') {
        const quarterGoal = await prisma.periodGoal.findFirst({
          where: { periodType: 'quarter', periodStart: horizonStartDate },
          orderBy: { createdAt: 'desc' },
        })
        if (quarterGoal) {
          horizonGoals = safeParseJson(quarterGoal.goalsJson, [])
        }
      } else if (forecastHorizon === 'year') {
        const year = horizonStartDate.getFullYear()
        const yearGoal = await prisma.yearGoal.findUnique({
          where: { year },
        })
        if (yearGoal) {
          horizonGoals = safeParseJson(yearGoal.goalsJson, [])
        }
      }
    }

    // Получить профиль пользователя
    const userProfile = await prisma.userProfile.findFirst({
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
          years: dream.years,
        },
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
