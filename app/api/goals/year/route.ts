import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/goals/year?year=2025
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const yearParam = searchParams.get('year')

    if (!yearParam) {
      return NextResponse.json({ error: 'year parameter is required' }, { status: 400 })
    }

    const year = parseInt(yearParam)
    const yearGoal = await prisma.yearGoal.findUnique({
      where: { year },
    })

    if (!yearGoal) {
      return NextResponse.json({ year, goals: [] })
    }

    return NextResponse.json({
      year: yearGoal.year,
      goals: JSON.parse(yearGoal.goalsJson),
    })
  } catch (error) {
    console.error('Error fetching year goal:', error)
    return NextResponse.json({ error: 'Failed to fetch year goal' }, { status: 500 })
  }
}

// POST /api/goals/year
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { year, goals } = body

    if (!year || !Array.isArray(goals)) {
      return NextResponse.json(
        { error: 'year and goals array are required' },
        { status: 400 }
      )
    }

    const yearGoal = await prisma.yearGoal.upsert({
      where: { year },
      update: {
        goalsJson: JSON.stringify(goals),
        updatedAt: new Date(),
      },
      create: {
        year,
        goalsJson: JSON.stringify(goals),
      },
    })

    return NextResponse.json({
      year: yearGoal.year,
      goals: JSON.parse(yearGoal.goalsJson),
    })
  } catch (error) {
    console.error('Error saving year goal:', error)
    return NextResponse.json({ error: 'Failed to save year goal' }, { status: 500 })
  }
}
