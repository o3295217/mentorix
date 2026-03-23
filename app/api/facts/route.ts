import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'
import { z } from 'zod'

const QuerySchema = z.object({
  period: z.enum(['week', 'month', 'all']).default('week'),
  type: z.enum(['task', 'goal', 'habit', 'extra', 'all']).default('all'),
  goalLink: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const params = Object.fromEntries(request.nextUrl.searchParams)
    const validation = QuerySchema.safeParse(params)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { period, type, goalLink, from, to, limit, offset } = validation.data

    // Определяем диапазон дат
    let dateFrom: Date | undefined
    let dateTo: Date | undefined

    if (from && to) {
      dateFrom = new Date(from + 'T00:00:00.000Z')
      dateTo = new Date(to + 'T23:59:59.999Z')
    } else {
      const now = new Date()
      if (period === 'week') {
        dateFrom = new Date(now)
        dateFrom.setDate(dateFrom.getDate() - ((now.getDay() + 6) % 7)) // Понедельник
        dateFrom.setHours(0, 0, 0, 0)
      } else if (period === 'month') {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
      }
      // all — без ограничения по дате
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId }
    if (dateFrom) where.date = { ...where.date, gte: dateFrom }
    if (dateTo) where.date = { ...where.date, lte: dateTo }
    if (type !== 'all') where.type = type
    if (goalLink) where.goalLink = goalLink

    const [items, total] = await Promise.all([
      prisma.completedWork.findMany({
        where,
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.completedWork.count({ where }),
    ])

    // Агрегация
    const stats = {
      total,
      byType: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
    }

    // Быстрая агрегация из выборки (для текущего периода)
    const allForStats = await prisma.completedWork.groupBy({
      by: ['type'],
      where,
      _count: true,
    })
    for (const g of allForStats) {
      stats.byType[g.type] = g._count
    }

    const allByCat = await prisma.completedWork.groupBy({
      by: ['category'],
      where,
      _count: true,
    })
    for (const g of allByCat) {
      stats.byCategory[g.category || 'другое'] = g._count
    }

    return NextResponse.json({ items, stats, limit, offset })
  } catch (error) {
    const statusCode = (error as any)?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error fetching facts:', error)
    return NextResponse.json({ error: 'Failed to fetch facts' }, { status: 500 })
  }
}
