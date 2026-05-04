import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'
import { buildPaginatedResponse, parsePaginationParams } from '@/lib/pagination'

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const { limit, offset } = parsePaginationParams(request.nextUrl.searchParams)
    const where = { userId, isClosed: true }
    const [tasks, total] = await Promise.all([
      prisma.openTask.findMany({
        where,
        orderBy: { closedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.openTask.count({ where }),
    ])

    return NextResponse.json(buildPaginatedResponse({ items: tasks, total, limit, offset }))
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error fetching closed tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch closed tasks' }, { status: 500 })
  }
}
