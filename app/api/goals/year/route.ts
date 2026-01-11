import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeParseJson } from '@/lib/api-utils'
import { z } from 'zod'
import { requireUserId } from '@/lib/get-user-id'

const YearGoalSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  goals: z.array(z.string()),
})

// GET /api/goals/year?year=2025
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const searchParams = request.nextUrl.searchParams
    const yearParam = searchParams.get('year')

    if (!yearParam) {
      return NextResponse.json({ error: 'year parameter is required' }, { status: 400 })
    }

    const year = parseInt(yearParam)
    if (isNaN(year)) {
      return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 })
    }
    const yearGoal = await prisma.yearGoal.findFirst({
      where: { userId, year },
    })

    if (!yearGoal) {
      return NextResponse.json({ year, goals: [] })
    }

    return NextResponse.json({
      year: yearGoal.year,
      goals: safeParseJson<string[]>(yearGoal.goalsJson, []),
    })
  } catch (error) {
    console.error('Error fetching year goal:', error)
    return NextResponse.json({ error: 'Failed to fetch year goal' }, { status: 500 })
  }
}

// POST /api/goals/year
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    
    const validation = YearGoalSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }
    
    const { year, goals } = validation.data

    // Ищем существующую запись
    const existing = await prisma.yearGoal.findFirst({
      where: { userId, year },
    })

    const yearGoal = existing
      ? await prisma.yearGoal.update({
          where: { id: existing.id },
          data: {
            goalsJson: JSON.stringify(goals),
            updatedAt: new Date(),
          },
        })
      : await prisma.yearGoal.create({
          data: {
            userId,
            year,
            goalsJson: JSON.stringify(goals),
          },
        })

    return NextResponse.json({
      year: yearGoal.year,
      goals: safeParseJson<string[]>(yearGoal.goalsJson, []),
    })
  } catch (error) {
    console.error('Error saving year goal:', error)
    return NextResponse.json({ error: 'Failed to save year goal' }, { status: 500 })
  }
}
