import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { safeParseJson } from '@/lib/api-utils'
import { requireUserId } from '@/lib/get-user-id'

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const periodType = request.nextUrl.searchParams.get('periodType') // week | month
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') || '10'), 50)

    const where: Prisma.WorkSummaryWhereInput = { userId }
    if (periodType) where.periodType = periodType

    const summaries = await prisma.workSummary.findMany({
      where,
      orderBy: { periodKey: 'desc' },
      take: limit,
    })

    return NextResponse.json(summaries.map(s => ({
      ...s,
      keyAchievements: safeParseJson<string[]>(s.keyAchievements, []),
      topCategories: safeParseJson<Record<string, number>>(s.topCategoriesJson, {}),
    })))
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error fetching work summaries:', error)
    return NextResponse.json({ error: 'Failed to fetch work summaries' }, { status: 500 })
  }
}
