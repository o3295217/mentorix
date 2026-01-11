import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeParseJsonArray } from '@/lib/fact-utils'
import { toDateKey } from '@/lib/dates'
import { requireUserId } from '@/lib/get-user-id'

// GET /api/daily/indicators?month=2025-11
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const searchParams = request.nextUrl.searchParams
    const monthParam = searchParams.get('month') // Формат: "2025-11"

    if (!monthParam) {
      return NextResponse.json({ error: 'Month parameter is required (format: YYYY-MM)' }, { status: 400 })
    }

    const [year, month] = monthParam.split('-').map(Number)

    // Начало и конец месяца
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    // Получить все daily entries за месяц
    const entries = await prisma.dailyEntry.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        evaluation: true,
      },
    })

    // Форматировать данные для календаря
    const indicators: Record<string, {
      hasPlan: boolean
      hasFact: boolean
      hasEvaluation: boolean
      dreamProgressScore?: number
    }> = {}

    entries.forEach((entry) => {
      const dateKey = toDateKey(entry.date) // local date key
      const selected = safeParseJsonArray<number>(entry.selectedTasksJson)
      indicators[dateKey] = {
        hasPlan: !!entry.planText,
        hasFact: selected.length > 0 || !!entry.factText,
        hasEvaluation: !!entry.evaluation,
        dreamProgressScore: entry.evaluation?.dreamProgressScore,
      }
    })

    return NextResponse.json(indicators)
  } catch (error) {
    console.error('Error fetching daily indicators:', error)
    return NextResponse.json(
      { error: 'Failed to fetch indicators', details: String(error) },
      { status: 500 }
    )
  }
}
