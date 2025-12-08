import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const MoveGoalSchema = z.object({
  id: z.number().int().positive(),
  toPeriodType: z.enum(['year', 'half_year', 'quarter', 'month', 'week']),
  toPeriodKey: z.string().min(1),
})

// POST - переместить цель в другой период
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const validation = MoveGoalSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }
    
    const { id, toPeriodType, toPeriodKey } = validation.data

    const goal = await prisma.goal.findUnique({ where: { id } })
    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    const history = JSON.parse(goal.historyJson)
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
      tags: JSON.parse(updatedGoal.tagsJson),
      blockedBy: JSON.parse(updatedGoal.blockedByJson),
      history: JSON.parse(updatedGoal.historyJson),
    })
  } catch (error) {
    console.error('Error moving goal:', error)
    return NextResponse.json({ error: 'Failed to move goal' }, { status: 500 })
  }
}
