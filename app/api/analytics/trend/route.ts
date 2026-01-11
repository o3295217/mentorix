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
      strategyScore: entry.evaluation?.strategyScore || 0,
      operationsScore: entry.evaluation?.operationsScore || 0,
      teamScore: entry.evaluation?.teamScore || 0,
      efficiencyScore: entry.evaluation?.efficiencyScore || 0,
    }))

    return NextResponse.json(trendData)
  } catch (error) {
    console.error('Error fetching trend data:', error)
    return NextResponse.json({ error: 'Failed to fetch trend data' }, { status: 500 })
  }
}
