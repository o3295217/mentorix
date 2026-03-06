import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { evaluateDayNewWithUsage, updateUserInsights } from '@/lib/anthropic'
import { DailyEvaluationRequest } from '@/lib/prompts/types'
import { getPeriodDates } from '@/lib/dates'
import { buildFactFromSelection, safeParseJsonArray } from '@/lib/fact-utils'
import { ApiErrors, safeParseJson } from '@/lib/api-utils'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import { recalculateUserStats } from '@/lib/user-stats'
import { requireUserId } from '@/lib/get-user-id'
import { logAIUsage } from '@/lib/ai-usage'

// In-memory lock и прогресс для предотвращения параллельных batch запросов
interface BatchProgress {
  startedAt: Date
  total: number
  current: number
  lastDate: string | null
}
const batchProgress = new Map<string, BatchProgress>()

// GET - получить список неоценённых дней
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)

    // Проверить есть ли активный batch
    const activeBatch = batchProgress.get(userId)
    const isLocked = activeBatch && (Date.now() - activeBatch.startedAt.getTime()) < 30 * 60 * 1000 // 30 мин таймаут

    // Найти все daily entries с планом и фактом, но без evaluation
    const allPotentialDays = await prisma.dailyEntry.findMany({
      where: {
        userId,
        planText: { not: null },
        OR: [
          { factText: { not: null } },
          { selectedTasksJson: { not: null } },
        ],
        evaluation: null,
      },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        date: true,
        planText: true,
        factText: true,
        selectedTasksJson: true,
        extraTasksJson: true,
      },
    })

    // Фильтруем только те, у которых реально есть выполненные задачи
    const unevaluatedDays = allPotentialDays.filter(d => {
      const hasFactText = d.factText && d.factText.trim().length > 0
      const selectedTasks = safeParseJsonArray<number>(d.selectedTasksJson)
      const extraTasks = safeParseJsonArray<string>(d.extraTasksJson)
      return hasFactText || selectedTasks.length > 0 || extraTasks.length > 0
    })

    return NextResponse.json({
      count: unevaluatedDays.length,
      days: unevaluatedDays.map((d) => ({
        id: d.id,
        date: d.date.toISOString().split('T')[0],
        planPreview: d.planText?.slice(0, 100) + (d.planText && d.planText.length > 100 ? '...' : ''),
      })),
      locked: isLocked,
      progress: isLocked ? {
        current: activeBatch!.current,
        total: activeBatch!.total,
        percent: Math.round((activeBatch!.current / activeBatch!.total) * 100),
        lastDate: activeBatch!.lastDate,
        startedAt: activeBatch!.startedAt.toISOString(),
      } : undefined,
    })
  } catch (error) {
    return ApiErrors.serverError('Failed to get unevaluated days', error)
  }
}

// POST - оценить все неоценённые дни
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)

    // Rate limiting by userId (not spoofable IP)
    const rateLimit = checkRateLimit(userId, rateLimiters.ai)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before requesting batch evaluation.', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    // Проверить lock - если уже идёт batch для этого пользователя
    const activeBatch = batchProgress.get(userId)
    if (activeBatch && (Date.now() - activeBatch.startedAt.getTime()) < 30 * 60 * 1000) {
      return NextResponse.json({
        success: false,
        evaluated: 0,
        failed: 0,
        message: `Уже идёт оценка ${activeBatch.current}/${activeBatch.total} дней. Дождитесь завершения.`,
        locked: true,
        progress: {
          current: activeBatch.current,
          total: activeBatch.total,
          percent: Math.round((activeBatch.current / activeBatch.total) * 100),
          lastDate: activeBatch.lastDate,
        },
      }, { status: 409 })
    }

    // Найти все неоценённые дни
    const allPotentialDays = await prisma.dailyEntry.findMany({
      where: {
        userId,
        planText: { not: null },
        OR: [
          { factText: { not: null } },
          { selectedTasksJson: { not: null } },
        ],
        evaluation: null,
      },
      orderBy: { date: 'asc' },
    })

    // Фильтруем только те, у которых реально есть выполненные задачи
    const unevaluatedDays = allPotentialDays.filter(d => {
      const hasFactText = d.factText && d.factText.trim().length > 0
      const selectedTasks = safeParseJsonArray<number>(d.selectedTasksJson)
      const extraTasks = safeParseJsonArray<string>(d.extraTasksJson)
      return hasFactText || selectedTasks.length > 0 || extraTasks.length > 0
    })

    if (unevaluatedDays.length === 0) {
      return NextResponse.json({
        success: true,
        evaluated: 0,
        failed: 0,
        message: 'Все дни уже оценены',
      })
    }

    // Установить lock с начальным прогрессом
    batchProgress.set(userId, { 
      startedAt: new Date(), 
      total: unevaluatedDays.length,
      current: 0,
      lastDate: null,
    })

    // Загрузить общие данные для оценки
    const dream = await prisma.dreamGoal.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    const userProfile = await prisma.userProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    const openTasks = await prisma.openTask.findMany({
      where: { userId, isClosed: false },
    })

    const results: { evaluated: number; failed: number; errors: string[] } = {
      evaluated: 0,
      failed: 0,
      errors: [],
    }

    // Оценить каждый день последовательно (чтобы не перегрузить API)
    for (const dailyEntry of unevaluatedDays) {
      try {
        // Пауза между запросами чтобы не превысить rate limit Claude
        if (results.evaluated > 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }

        // Подготовить план
        const planSnapshotTasks = safeParseJsonArray<string>(dailyEntry.planSnapshotJson)
        const planTextForEval = planSnapshotTasks.length > 0
          ? planSnapshotTasks.join('\n')
          : (dailyEntry.planText || '')

        // Подготовить факт
        const derived = buildFactFromSelection({
          planText: dailyEntry.planText,
          factText: dailyEntry.factText,
          selectedTasksJson: dailyEntry.selectedTasksJson,
        })

        const extraTasks = safeParseJsonArray<string>(dailyEntry.extraTasksJson)

        if (!derived.factText && extraTasks.length === 0) {
          results.errors.push(`${dailyEntry.date.toLocaleDateString('ru-RU')}: нет выполненных задач`)
          results.failed++
          continue
        }

        // Загрузить цели для конкретной даты
        const date = dailyEntry.date
        const year = date.getFullYear()

        const halfYearPeriod = getPeriodDates(date, 'half_year')
        const quarterPeriod = getPeriodDates(date, 'quarter')
        const monthPeriod = getPeriodDates(date, 'month')
        const weekPeriod = getPeriodDates(date, 'week')

        const [currentYearGoal, halfYearGoals, quarterGoals, monthGoals, weekGoals] =
          await Promise.all([
            prisma.yearGoal.findFirst({ where: { userId, year } }),
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

        // Сформировать запрос
        const evaluationRequest: DailyEvaluationRequest = {
          date: date.toLocaleDateString('ru-RU'),
          planText: planTextForEval,
          factText: derived.factText,
          uncompletedTasks: derived.uncompletedTasks,
          extraTasks,
          goals: {
            dreamGoal: dream?.goalText || 'Не указана',
            dreamYears: dream?.years,
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

        // Вызвать Claude API
        const { result: evaluationResponse, usage } = await evaluateDayNewWithUsage(evaluationRequest)

        // Логируем использование AI
        await logAIUsage({
          userId,
          endpoint: 'evaluate-batch',
          model: usage.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          durationMs: usage.durationMs,
          success: true,
        })

        // Сохранить оценку
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
          healthFlag: evaluationResponse.balance_flags.health,
          familyFlag: evaluationResponse.balance_flags.family,
          energyFlag: evaluationResponse.balance_flags.energy,
          workHealthAlignment: evaluationResponse.horizontal_alignment?.work_health,
          workFamilyAlignment: evaluationResponse.horizontal_alignment?.work_family,
          workValuesAlignment: evaluationResponse.horizontal_alignment?.work_values,
          suggestedTasksJson: evaluationResponse.suggested_tasks
            ? JSON.stringify(evaluationResponse.suggested_tasks)
            : null,
        }

        await prisma.evaluation.upsert({
          where: { dailyEntryId: dailyEntry.id },
          create: { dailyEntryId: dailyEntry.id, ...evaluationData },
          update: evaluationData,
        })

        results.evaluated++
        
        // Обновить прогресс в памяти
        const progress = batchProgress.get(userId)
        if (progress) {
          progress.current = results.evaluated
          progress.lastDate = dailyEntry.date.toLocaleDateString('ru-RU')
        }
        
        console.log(`[BatchEvaluate] Evaluated ${dailyEntry.date.toLocaleDateString('ru-RU')} (${results.evaluated}/${unevaluatedDays.length})`)
      } catch (dayError) {
        console.error(`[BatchEvaluate] Failed to evaluate ${dailyEntry.date}:`, dayError)
        results.errors.push(`${dailyEntry.date.toLocaleDateString('ru-RU')}: ${dayError instanceof Error ? dayError.message : 'Unknown error'}`)
        results.failed++
      }
    }

    // Обновить статистику один раз в конце
    try {
      await recalculateUserStats(userId)
    } catch (statsError) {
      console.error('[BatchEvaluate] Failed to recalculate stats:', statsError)
    }

    // Обновить insights если что-то было оценено
    if (results.evaluated > 0) {
      try {
        const currentInsights = await prisma.userInsights.findFirst({ where: { userId } })
        
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        
        const recentEntries = await prisma.dailyEntry.findMany({
          where: { userId, date: { gte: sevenDaysAgo }, evaluation: { isNot: null } },
          include: { evaluation: true },
          orderBy: { date: 'desc' },
          take: 7,
        })

        const recentDays = recentEntries.map((entry) => {
          const planTasks = entry.planText?.split('\n').filter((t) => t.trim()).length || 0
          const selectedTasks = safeParseJson<number[]>(entry.selectedTasksJson, [])
          return {
            date: entry.date.toLocaleDateString('ru-RU'),
            planTasks,
            completedTasks: selectedTasks.length,
            dreamScore: entry.evaluation?.dreamProgressScore || 5,
            overallScore: Math.round(entry.evaluation?.overallScore || 5),
          }
        })

        const insightsUpdate = await updateUserInsights({
          currentInsights: currentInsights
            ? {
                patterns: currentInsights.patterns || undefined,
                strengths: currentInsights.strengths || undefined,
                challenges: currentInsights.challenges || undefined,
                preferences: currentInsights.preferences || undefined,
                recommendations: currentInsights.recommendations || undefined,
                motivators: currentInsights.motivators || undefined,
              }
            : null,
          evaluationCount: (currentInsights?.evaluationCount || 0) + results.evaluated,
          planText: '',
          factText: '',
          evaluationFeedback: 'Batch evaluation completed',
          dreamProgressScore: 5,
          overallScore: 5,
          recentDays,
        })

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
              evaluationCount: (currentInsights.evaluationCount || 0) + results.evaluated,
            },
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
              evaluationCount: results.evaluated,
            },
          })
        }
      } catch (insightsError) {
        console.error('[BatchEvaluate] Failed to update insights:', insightsError)
      }
    }

    // Снять lock
    batchProgress.delete(userId)

    return NextResponse.json({
      success: true,
      evaluated: results.evaluated,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined,
      message: `Оценено ${results.evaluated} из ${unevaluatedDays.length} дней`,
    })
  } catch (error) {
    // Снять lock при ошибке
    try {
      const userId = await requireUserId(request)
      batchProgress.delete(userId)
    } catch { /* ignore */ }
    return ApiErrors.serverError('Failed to batch evaluate days', error)
  }
}
