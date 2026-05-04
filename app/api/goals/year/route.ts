import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { safeParseJson } from '@/lib/api-utils'
import { z } from 'zod'
import { requireUserId } from '@/lib/get-user-id'
import { randomBytes } from 'crypto'

const YearGoalItemSchema = z.union([
  z.string(),
  z.object({ id: z.string(), text: z.string() }),
])

const YearGoalSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  goals: z.array(YearGoalItemSchema),
})

interface YearGoalItem {
  id: string
  text: string
}

function generateYearGoalId(): string {
  return 'yg_' + randomBytes(6).toString('hex')
}

/** Parse goalsJson: supports both legacy string[] and new {id,text}[] */
function parseGoalsJson(raw: unknown): YearGoalItem[] {
  const parsed = safeParseJson<Array<string | YearGoalItem>>(raw, [])
  return parsed.map(item =>
    typeof item === 'string'
      ? { id: generateYearGoalId(), text: item }
      : item
  )
}

/** Normalize incoming goals array to {id,text}[] */
function normalizeGoals(goals: Array<string | { id?: string; text: string }>): YearGoalItem[] {
  return goals.map(item =>
    typeof item === 'string'
      ? { id: generateYearGoalId(), text: item }
      : { id: item.id || generateYearGoalId(), text: item.text }
  )
}

// GET /api/goals/year?year=2025
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const searchParams = request.nextUrl.searchParams
    const yearParam = searchParams.get('year')

    if (!yearParam) {
      const yearGoals = await prisma.yearGoal.findMany({
        where: { userId },
        select: { year: true, goalsJson: true },
        orderBy: { year: 'asc' },
      })

      return NextResponse.json({
        years: yearGoals
          .filter((item) => parseGoalsJson(item.goalsJson).length > 0)
          .map((item) => item.year),
      })
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
      goals: parseGoalsJson(yearGoal.goalsJson),
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
    
    const { year, goals: rawGoals } = validation.data
    const goals = normalizeGoals(rawGoals as Array<string | { id?: string; text: string }>)

    // Ищем существующую запись
    const existing = await prisma.yearGoal.findFirst({
      where: { userId, year },
    })

    // Сохраняем ID существующих целей, если текст совпадает
    if (existing) {
      const existingGoals = parseGoalsJson(existing.goalsJson)
      for (const goal of goals) {
        if (!goal.id || goal.id.startsWith('yg_')) {
          const match = existingGoals.find(e => e.text === goal.text)
          if (match) goal.id = match.id
        }
      }
    }

    const yearGoal = existing
      ? await prisma.yearGoal.update({
          where: { id: existing.id },
          data: {
            goalsJson: goals as unknown as Prisma.InputJsonValue,
            updatedAt: new Date(),
          },
        })
      : await prisma.yearGoal.create({
          data: {
            userId,
            year,
            goalsJson: goals as unknown as Prisma.InputJsonValue,
          },
        })

    return NextResponse.json({
      year: yearGoal.year,
      goals: parseGoalsJson(yearGoal.goalsJson),
    })
  } catch (error) {
    console.error('Error saving year goal:', error)
    return NextResponse.json({ error: 'Failed to save year goal' }, { status: 500 })
  }
}
