import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { evaluateDayNew, updateUserInsights } from '@/lib/anthropic'
import { DailyEvaluationRequest } from '@/lib/prompts/types'
import { getPeriodDates } from '@/lib/dates'
import { buildFactFromSelection, safeParseJsonArray } from '@/lib/fact-utils'
import { z } from 'zod'
import { ApiErrors, safeParseJson } from '@/lib/api-utils'
import { checkRateLimit, getClientIdentifier, rateLimiters } from '@/lib/rate-limit'
import { recalculateUserStats } from '@/lib/user-stats'
import { requireUserId } from '@/lib/get-user-id'

const EvaluateSchema = z.object({
  dailyEntryId: z.number().int().positive(),
})

export async function POST(request: NextRequest) {
  // Rate limiting for AI endpoints
  const clientId = getClientIdentifier(request)
  const rateLimit = checkRateLimit(clientId, rateLimiters.ai)

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before requesting another evaluation.', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    )
  }

  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    
    const validation = EvaluateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { dailyEntryId } = validation.data

    // Получить daily entry (проверяем принадлежность пользователю)
    const dailyEntry = await prisma.dailyEntry.findFirst({
      where: { id: dailyEntryId, userId },
    })

    if (!dailyEntry) {
      return NextResponse.json({ error: 'Daily entry not found' }, { status: 404 })
    }

    // План для оценки: берем снимок плана (если есть), иначе текущий план
    const planSnapshotTasks = safeParseJsonArray<string>(dailyEntry.planSnapshotJson)
    const planTextForEval = planSnapshotTasks.length > 0
      ? planSnapshotTasks.join('\n')
      : (dailyEntry.planText || '')

    // Факт из чекбоксов (по текущему плану) или fallback на factText
    const derived = buildFactFromSelection({
      planText: dailyEntry.planText,
      factText: dailyEntry.factText,
      selectedTasksJson: dailyEntry.selectedTasksJson,
    })

    const extraTasks = safeParseJsonArray<string>(dailyEntry.extraTasksJson)

    if (!derived.factText && extraTasks.length === 0) {
      return NextResponse.json(
        { error: 'No completed tasks. Mark tasks as done before evaluation.' },
        { status: 400 }
      )
    }

    // Получить мечту
    const dream = await prisma.dreamGoal.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    // Получить все цели из новой иерархической структуры
    const date = dailyEntry.date
    const year = date.getFullYear()

    // Периоды для загрузки из period_goals
    const halfYearPeriod = getPeriodDates(date, 'half_year')
    const quarterPeriod = getPeriodDates(date, 'quarter')
    const monthPeriod = getPeriodDates(date, 'month')
    const weekPeriod = getPeriodDates(date, 'week')

    const [currentYearGoal, halfYearGoals, quarterGoals, monthGoals, weekGoals] =
      await Promise.all([
        // Загружаем цели на год из year_goals
        prisma.yearGoal.findFirst({
          where: { userId, year },
        }),
        // Остальные цели из period_goals (как раньше)
        prisma.periodGoal.findFirst({
          where: { userId, periodType: 'half_year', periodStart: halfYearPeriod.start },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.periodGoal.findFirst({
          where: { userId, periodType: 'quarter', periodStart: quarterPeriod.start },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.periodGoal.findFirst({
          where: { userId, periodType: 'month', periodStart: monthPeriod.start },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.periodGoal.findFirst({
          where: { userId, periodType: 'week', periodStart: weekPeriod.start },
          orderBy: { createdAt: 'desc' },
        }),
      ])

    // Получить незакрытые задачи
    const openTasks = await prisma.openTask.findMany({
      where: { userId, isClosed: false },
    })

    // Получить профиль пользователя
    const userProfile = await prisma.userProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    // Подготовить запрос для оценки (ОБНОВЛЕННЫЙ ФОРМАТ)
    const evaluationRequest: DailyEvaluationRequest = {
      date: date.toLocaleDateString('ru-RU'),
      planText: planTextForEval,
      factText: derived.factText,
      extraTasks,
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
      create: { userId, dailyEntryId, ...evaluationData },
      update: evaluationData,
    })

    // === ОБНОВЛЕНИЕ ПРОФИЛЯ ПОНИМАНИЯ ПОЛЬЗОВАТЕЛЯ ===
    try {
      // Получить текущий профиль insights
      const currentInsights = await prisma.userInsights.findFirst({
        where: { userId }
      })
      
      // Получить историю последних 7 дней для контекста
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const recentEntries = await prisma.dailyEntry.findMany({
        where: {
          userId,
          date: { gte: sevenDaysAgo },
          evaluation: { isNot: null }
        },
        include: { evaluation: true },
        orderBy: { date: 'desc' },
        take: 7
      })

      const recentDays = recentEntries.map(entry => {
        const planTasks = entry.planText?.split('\n').filter(t => t.trim()).length || 0
        const selectedTasks = safeParseJson<number[]>(entry.selectedTasksJson, [])
        return {
          date: entry.date.toLocaleDateString('ru-RU'),
          planTasks,
          completedTasks: selectedTasks.length,
          dreamScore: entry.evaluation?.dreamProgressScore || 5,
          overallScore: Math.round(entry.evaluation?.overallScore || 5)
        }
      })

      // Подготовить запрос для обновления insights
      const insightsUpdate = await updateUserInsights({
        currentInsights: currentInsights ? {
          patterns: currentInsights.patterns || undefined,
          strengths: currentInsights.strengths || undefined,
          challenges: currentInsights.challenges || undefined,
          preferences: currentInsights.preferences || undefined,
          recommendations: currentInsights.recommendations || undefined,
          motivators: currentInsights.motivators || undefined,
        } : null,
        evaluationCount: (currentInsights?.evaluationCount || 0) + 1,
        planText: dailyEntry.planText || '',
        factText: derived.factText,
        evaluationFeedback: evaluationResponse.feedback,
        dreamProgressScore: evaluationResponse.dream_progress_score,
        overallScore: evaluationResponse.overall_score,
        recentDays
      })

      // Сохранить обновлённый профиль
      if (currentInsights) {
        await prisma.userInsights.update({
          where: { id: currentInsights.id },
          data: {
            patterns: insightsUpdate.patterns || currentInsights.patterns,
            strengths: insightsUpdate.strengths || currentInsights.strengths,
            challenges: insightsUpdate.challenges || currentInsights.challenges,
            preferences: insightsUpdate.preferences || currentInsights.preferences,
            recommendations: insightsUpdate.recommendations || currentInsights.recommendations,
            motivators: insightsUpdate.motivators || currentInsights.motivators,
            evaluationCount: (currentInsights.evaluationCount || 0) + 1
          }
        })
      } else {
        await prisma.userInsights.create({
          data: {
            userId,
            patterns: insightsUpdate.patterns,
            strengths: insightsUpdate.strengths,
            challenges: insightsUpdate.challenges,
            preferences: insightsUpdate.preferences,
            recommendations: insightsUpdate.recommendations,
            motivators: insightsUpdate.motivators,
            evaluationCount: 1
          }
        })
      }

      console.log('[UserInsights] Profile updated successfully')
    } catch (insightsError) {
      // Не прерываем оценку если обновление профиля не удалось
      console.error('[UserInsights] Failed to update profile:', insightsError)
    }

    // === ОБНОВЛЕНИЕ НАКОПИТЕЛЬНОЙ СТАТИСТИКИ ===
    try {
      await recalculateUserStats(userId)
    } catch (statsError) {
      console.error('[UserStats] Failed to recalculate stats:', statsError)
    }

    return NextResponse.json(evaluation)
  } catch (error) {
    return ApiErrors.serverError('Failed to evaluate day', error)
  }
}
