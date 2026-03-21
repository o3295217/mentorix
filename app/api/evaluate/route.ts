import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { evaluateDayNewWithUsage, updateUserInsights } from '@/lib/anthropic'
import { DailyEvaluationRequest } from '@/lib/prompts/types'
import { getPeriodDates } from '@/lib/dates'
import { buildFactFromSelection, safeParseJsonArray } from '@/lib/fact-utils'
import { z } from 'zod'
import { ApiErrors, safeParseJson } from '@/lib/api-utils'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import { recalculateUserStats } from '@/lib/user-stats'
import { requireUserId } from '@/lib/get-user-id'
import { logAIUsage } from '@/lib/ai-usage'
import { recalculateWorkSummary } from '@/lib/completed-work'

const EvaluateSchema = z.object({
  dailyEntryId: z.number().int().positive(),
})

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)

    // Rate limiting by userId (not spoofable IP)
    const rateLimit = checkRateLimit(userId, rateLimiters.ai)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before requesting another evaluation.', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }
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

    // Получить последние 3 оценки для контекста (чтобы не повторять рекомендации)
    const recentEvaluations = await prisma.evaluation.findMany({
      where: {
        dailyEntry: { userId },
      },
      include: {
        dailyEntry: { select: { date: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    })

    const previousFeedback = recentEvaluations.map((ev) => {
      let feedbackConclusion = ''
      try {
        const parsed = JSON.parse(ev.feedbackText)
        if (parsed && typeof parsed === 'object' && parsed.conclusion) {
          feedbackConclusion = parsed.conclusion
        } else {
          feedbackConclusion = ev.feedbackText.slice(0, 200)
        }
      } catch {
        feedbackConclusion = ev.feedbackText.slice(0, 200)
      }
      return {
        date: ev.dailyEntry.date.toLocaleDateString('ru-RU'),
        recommendations: ev.recommendationsText,
        feedbackConclusion,
      }
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
      uncompletedTasks: derived.uncompletedTasks,
      extraTasks,
      goals: {
        dreamGoal: dream?.goalText || 'Не указана',
        dreamYears: dream?.months ? Math.ceil(dream.months / 12) : undefined,
        dreamMonths: dream?.months || undefined,
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
      previousFeedback: previousFeedback.length > 0 ? previousFeedback : undefined,
    }

    // Вызвать Claude API (с логированием usage)
    const { result: evaluationResponse, usage } = await evaluateDayNewWithUsage(evaluationRequest)

    // Логируем использование AI
    await logAIUsage({
      userId,
      endpoint: 'evaluate',
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      durationMs: usage.durationMs,
      success: true,
    })

    // Подготовить данные для сохранения (DRY - не дублируем в create/update)
    const evaluationData = {
      dreamProgressScore: evaluationResponse.dream_progress_score,
      strategicFocusScore: evaluationResponse.strategic_focus_score,
      productivityScore: evaluationResponse.productivity_score,
      lifeBalanceScore: evaluationResponse.life_balance_score,
      disciplineScore: evaluationResponse.discipline_score,
      overallScore: evaluationResponse.overall_score,
      feedbackText: typeof evaluationResponse.feedback === 'object'
        ? JSON.stringify(evaluationResponse.feedback)
        : evaluationResponse.feedback,
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

    // === ОБНОВЛЕНИЕ ПРОФИЛЯ ПОНИМАНИЯ ПОЛЬЗОВАТЕЛЯ ===
    try {
      // Получить текущий профиль insights
      const currentInsights = await prisma.userInsights.findFirst({
        where: { userId }
      })

      // Загрузить накопленный кэш знаний (все наблюдения)
      const knowledgeCache = await prisma.insightEntry.findMany({
        where: { userId },
        select: { date: true, category: true, text: true },
        orderBy: { createdAt: 'desc' },
        take: 100, // последние 100 наблюдений
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
      const dateKey = `${dailyEntry.date.getFullYear()}-${String(dailyEntry.date.getMonth() + 1).padStart(2, '0')}-${String(dailyEntry.date.getDate()).padStart(2, '0')}`
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
        date: dateKey,
        planText: dailyEntry.planText || '',
        factText: derived.factText,
        evaluationFeedback: typeof evaluationResponse.feedback === 'object'
          ? `${evaluationResponse.feedback.conclusion}\n${evaluationResponse.feedback.worked}\n${evaluationResponse.feedback.blocks}`
          : evaluationResponse.feedback,
        dreamProgressScore: evaluationResponse.dream_progress_score,
        overallScore: evaluationResponse.overall_score,
        recentDays,
        knowledgeCache,
      })

      // Сохранить новые наблюдения в кэш знаний
      if (insightsUpdate.entries && insightsUpdate.entries.length > 0) {
        const validCategories = ['pattern', 'strength', 'challenge', 'preference', 'motivator', 'observation']
        const validEntries = insightsUpdate.entries.filter(
          e => e.text && e.category && validCategories.includes(e.category)
        )
        if (validEntries.length > 0) {
          await prisma.insightEntry.createMany({
            data: validEntries.map(e => ({
              userId,
              date: dateKey,
              category: e.category,
              text: e.text,
              score: evaluationResponse.overall_score,
            }))
          })
          console.log(`[KnowledgeCache] Added ${validEntries.length} entries for ${dateKey}`)
        }
      }

      // Сохранить обновлённый профиль
      if (currentInsights) {
        await prisma.userInsights.update({
          where: { id: currentInsights.id },
          data: {
            patterns: insightsUpdate.profile.patterns || currentInsights.patterns,
            strengths: insightsUpdate.profile.strengths || currentInsights.strengths,
            challenges: insightsUpdate.profile.challenges || currentInsights.challenges,
            preferences: insightsUpdate.profile.preferences || currentInsights.preferences,
            recommendations: insightsUpdate.profile.recommendations || currentInsights.recommendations,
            motivators: insightsUpdate.profile.motivators || currentInsights.motivators,
            evaluationCount: (currentInsights.evaluationCount || 0) + 1
          }
        })
      } else {
        await prisma.userInsights.create({
          data: {
            userId,
            patterns: insightsUpdate.profile.patterns,
            strengths: insightsUpdate.profile.strengths,
            challenges: insightsUpdate.profile.challenges,
            preferences: insightsUpdate.profile.preferences,
            recommendations: insightsUpdate.profile.recommendations,
            motivators: insightsUpdate.profile.motivators,
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

    // === ПЕРЕСЧЁТ СВОДОК ВЫПОЛНЕННОЙ РАБОТЫ ===
    try {
      await recalculateWorkSummary(userId, dailyEntry.date)
    } catch (wsError) {
      console.error('[WorkSummary] Failed to recalculate:', wsError)
    }

    return NextResponse.json(evaluation)
  } catch (error) {
    return ApiErrors.serverError('Failed to evaluate day', error)
  }
}
