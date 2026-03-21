import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subDays } from 'date-fns'
import { toDateKey } from '@/lib/dates'
import { requireUserId } from '@/lib/get-user-id'

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30')

    const startDate = subDays(new Date(), days)

    const entries = await prisma.dailyEntry.findMany({
      where: {
        userId,
        date: { gte: startDate },
        evaluation: { isNot: null },
      },
      include: { evaluation: true },
      orderBy: { date: 'asc' },
    })

    const trendData = entries.map((entry) => ({
      date: toDateKey(entry.date),
      overallScore: entry.evaluation?.overallScore || 0,
      dreamProgressScore: entry.evaluation?.dreamProgressScore || 0,
      strategicFocusScore: entry.evaluation?.strategicFocusScore || 0,
      productivityScore: entry.evaluation?.productivityScore || 0,
      lifeBalanceScore: entry.evaluation?.lifeBalanceScore || 0,
      disciplineScore: entry.evaluation?.disciplineScore || 0,
    }))

    return NextResponse.json(trendData)
  } catch (error) {
    console.error('Error fetching trend data:', error)
    return NextResponse.json({ error: 'Failed to fetch trend data' }, { status: 500 })
  }
}
