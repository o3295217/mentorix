import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeParseJson } from '@/lib/api-utils'
import { z } from 'zod'
import { requireUserId } from '@/lib/get-user-id'

const MoveGoalSchema = z.object({
  id: z.number().int().positive(),
  toPeriodType: z.enum(['year', 'half_year', 'quarter', 'month', 'week']),
  toPeriodKey: z.string().min(1),
})

// POST - переместить цель в другой период
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    
    const validation = MoveGoalSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }
    
    const { id, toPeriodType, toPeriodKey } = validation.data

    const goal = await prisma.goal.findFirst({ where: { id, userId } })
    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    const history = safeParseJson<Array<{ type: string; date: string; from?: unknown; to?: unknown }>>(goal.historyJson, [])
    history.push({
      type: 'moved',
      date: new Date().toISOString(),
      from: { periodType: goal.periodType, periodKey: goal.periodKey },
      to: { periodType: toPeriodType, periodKey: toPeriodKey },
    })

    const updatedGoal = await prisma.goal.update({
      where: { id },
      data: {
        periodType: toPeriodType,
        periodKey: toPeriodKey,
        historyJson: JSON.stringify(history),
      },
    })

    return NextResponse.json({
      ...updatedGoal,
      tags: safeParseJson<string[]>(updatedGoal.tagsJson, []),
      blockedBy: safeParseJson<number[]>(updatedGoal.blockedByJson, []),
      history: safeParseJson<Array<{ type: string; date: string }>>(updatedGoal.historyJson, []),
    })
  } catch (error) {
    console.error('Error moving goal:', error)
    return NextResponse.json({ error: 'Failed to move goal' }, { status: 500 })
  }
}
