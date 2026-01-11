import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    
    // Получить все оценки
    const evaluations = await prisma.evaluation.findMany({
      where: { userId },
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
        productiveDays: 0,
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
      })
    }

    // Рассчитываем метрики
    const productiveDays = evaluations.filter((e) => (e.dreamProgressScore || 0) >= 7).length
    const totalDays = evaluations.length

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

    // Вехи (milestones)
    const milestones = {
      '10': productiveDays >= 10,
      '30': productiveDays >= 30,
      '100': productiveDays >= 100,
      '365': productiveDays >= 365,
      '1000': productiveDays >= 1000,
    }

    // Процент прогресса к мечте (5 лет = 1825 дней)
    const targetDays = 1825
    const progressPercent = Math.min(100, (productiveDays / targetDays) * 100)

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
      productiveDays,
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
    console.error('Error fetching progress stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch progress stats' },
      { status: 500 }
    )
  }
}
