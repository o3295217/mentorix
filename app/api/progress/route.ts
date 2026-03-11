import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    
    // Получить мечту пользователя
    const dreamGoal = await prisma.dreamGoal.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    const dreamYears = dreamGoal?.years || 5

    // Первый запланированный день — начало отсчёта
    const firstEntry = await prisma.dailyEntry.findFirst({
      where: { userId },
      orderBy: { date: 'asc' },
      select: { date: true },
    })
    const startDate = firstEntry?.date || new Date()
    const elapsedDays = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))

    // Сколько дней было спланировано (всего DailyEntry)
    const plannedDays = await prisma.dailyEntry.count({ where: { userId } })

    // Получить все оценки через dailyEntry
    const evaluations = await prisma.evaluation.findMany({
      where: { 
        dailyEntry: {
          userId 
        }
      },
      include: {
        dailyEntry: true,
      },
      orderBy: {
        dailyEntry: {
          date: 'asc',
        },
      },
    })

    if (evaluations.length === 0) {
      return NextResponse.json({
        currentSpeed: 0,
        totalDays: 0,
        effectiveDays: 0,
        elapsedDays,
        plannedDays,
        evaluatedDays: 0,
        currentStreak: 0,
        longestStreak: 0,
        avgSpeed30d: 0,
        fuelLevel: 100,
        milestones: {
          '10': false,
          '30': false,
          '100': false,
          '365': false,
          '1000': false,
        },
        progressPercent: 0,
        targetDays: dreamYears * 365,
      })
    }

    // Рассчитываем метрики
    const totalDays = evaluations.length

    // Эффективные дни: каждый день вносит вклад пропорционально оценке (10 = 1 день, 5 = 0.5 дня)
    const totalScore = evaluations.reduce((sum, e) => sum + (e.dreamProgressScore || 0), 0)
    const effectiveDays = totalScore / 10

    // Средняя скорость за последние 7 дней
    const last7Days = evaluations.slice(-7)
    const currentSpeed =
      last7Days.length > 0
        ? last7Days.reduce((sum, e) => sum + (e.dreamProgressScore || 0), 0) / last7Days.length
        : 0

    // Средняя скорость за последние 30 дней
    const last30Days = evaluations.slice(-30)
    const avgSpeed30d =
      last30Days.length > 0
        ? last30Days.reduce((sum, e) => sum + (e.dreamProgressScore || 0), 0) / last30Days.length
        : 0

    // Текущий streak (дни подряд с score >= 7)
    let currentStreak = 0
    for (let i = evaluations.length - 1; i >= 0; i--) {
      if ((evaluations[i].dreamProgressScore || 0) >= 7) {
        currentStreak++
      } else {
        break
      }
    }

    // Самый длинный streak
    let longestStreak = 0
    let tempStreak = 0
    for (const e of evaluations) {
      if ((e.dreamProgressScore || 0) >= 7) {
        tempStreak++
        longestStreak = Math.max(longestStreak, tempStreak)
      } else {
        tempStreak = 0
      }
    }

    // Уровень топлива (баланс) - процент дней где все 3 флага = "ok"
    const balancedDays = evaluations.filter(
      (e) => e.healthFlag === 'ok' && e.familyFlag === 'ok' && e.energyFlag === 'ok'
    ).length
    const fuelLevel = totalDays > 0 ? Math.round((balancedDays / totalDays) * 100) : 100

    // Вехи (milestones) — по количеству оценённых дней (показывает упорство)
    const milestones = {
      '10': totalDays >= 10,
      '30': totalDays >= 30,
      '100': totalDays >= 100,
      '365': totalDays >= 365,
      '1000': totalDays >= 1000,
    }

    // Процент прогресса к мечте
    const targetDays = dreamYears * 365
    const progressPercent = Math.min(100, (effectiveDays / targetDays) * 100)

    // Данные для графика последних 30 дней
    const last30DaysData = last30Days.map((e) => ({
      date: e.dailyEntry.date,
      score: e.dreamProgressScore || 0,
    }))

    // Распределение по скоростям
    const distribution = {
      excellent: evaluations.filter((e) => (e.dreamProgressScore || 0) >= 7).length,
      medium: evaluations.filter(
        (e) => (e.dreamProgressScore || 0) >= 4 && (e.dreamProgressScore || 0) < 7
      ).length,
      poor: evaluations.filter((e) => (e.dreamProgressScore || 0) < 4).length,
    }

    return NextResponse.json({
      currentSpeed: Number(currentSpeed.toFixed(1)),
      totalDays,
      effectiveDays: Number(effectiveDays.toFixed(1)),
      elapsedDays,
      plannedDays,
      evaluatedDays: totalDays,
      currentStreak,
      longestStreak,
      avgSpeed30d: Number(avgSpeed30d.toFixed(1)),
      fuelLevel,
      milestones,
      progressPercent: Number(progressPercent.toFixed(2)),
      last30DaysData,
      distribution,
      targetDays,
    })
  } catch (error) {
    const statusCode = (error as any)?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error fetching progress stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch progress stats' },
      { status: 500 }
    )
  }
}
