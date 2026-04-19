import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'

/**
 * Returns average dreamProgressScore grouped by year.
 * Used in StrategyCards to blend daily AI evaluations into year progress.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)

    const evaluations = await prisma.evaluation.findMany({
      where: { dailyEntry: { userId } },
      select: {
        dreamProgressScore: true,
        dailyEntry: { select: { date: true } },
      },
    })

    // Group by year
    const byYear: Record<number, { sum: number; count: number }> = {}
    for (const ev of evaluations) {
      const year = ev.dailyEntry.date.getFullYear()
      if (!byYear[year]) byYear[year] = { sum: 0, count: 0 }
      byYear[year].sum += ev.dreamProgressScore || 0
      byYear[year].count++
    }

    // Convert to { year: { avg, count } }
    const result: Record<number, { avg: number; count: number }> = {}
    for (const [year, data] of Object.entries(byYear)) {
      result[Number(year)] = {
        avg: Math.round((data.sum / data.count) * 10) / 10,
        count: data.count,
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
