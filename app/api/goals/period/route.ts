// Цели периода. Источник правды — записи Goal (по periodKey):
// GET отдаёт их с id и статусом выполнения (Goal.completed — единственная
// правда, динамического матчинга по задачам больше нет), POST принимает
// желаемый список текстов и сверяет его с записями (см. lib/period-goals).
// PeriodGoal остаётся только для periodType='year' (легаси, UI не использует).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPeriodDates, parseDateParam, PeriodType } from '@/lib/dates'
import { getPeriodKey } from '@/lib/goals-utils'
import { safeParseJson } from '@/lib/api-utils'
import { z } from 'zod'
import { requireUserId } from '@/lib/get-user-id'
import { listPeriodGoalRows, reconcilePeriodGoals, GoalPeriodType } from '@/lib/period-goals'

const PeriodGoalSchema = z.object({
  periodType: z.enum(['week', 'month', 'quarter', 'half_year', 'year']),
  periodStart: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' }),
  periodEnd: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' }),
  goals: z.array(z.string()),
})

const isGoalPeriodType = (t: string): t is GoalPeriodType =>
  t === 'week' || t === 'month' || t === 'quarter' || t === 'half_year'

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') as PeriodType
    const dateStr = searchParams.get('date')

    if (!type || !dateStr) {
      return NextResponse.json({ error: 'type and date are required' }, { status: 400 })
    }

    const date = parseDateParam(dateStr)
    const { start, end } = getPeriodDates(date, type)

    if (!isGoalPeriodType(type)) {
      // Легаси-ветка для 'year' — данные из PeriodGoal
      const periodGoal = await prisma.periodGoal.findUnique({
        where: { userId_periodType_periodStart: { userId, periodType: type, periodStart: start } },
      })
      const goals = periodGoal ? safeParseJson<string[]>(periodGoal.goalsJson, []) : []
      return NextResponse.json({
        periodType: type,
        periodStart: start,
        periodEnd: end,
        goals: goals.map(text => ({ text, completed: false })),
      })
    }

    const periodKey = getPeriodKey(type, date)
    const rows = await listPeriodGoalRows(userId, periodKey)

    return NextResponse.json({
      periodType: type,
      periodKey,
      periodStart: start,
      periodEnd: end,
      goals: rows.map(r => ({
        id: r.id,
        text: r.text,
        completed: r.completed,
        priority: r.priority,
      })),
    })
  } catch (error) {
    console.error('Error fetching period goals:', error)
    return NextResponse.json({ error: 'Failed to fetch period goals' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()

    const validation = PeriodGoalSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { periodType, periodStart, periodEnd, goals } = validation.data
    const parsedStart = parseDateParam(periodStart)
    const parsedEnd = parseDateParam(periodEnd)

    if (!isGoalPeriodType(periodType)) {
      // Легаси-ветка для 'year'
      const periodGoal = await prisma.periodGoal.upsert({
        where: { userId_periodType_periodStart: { userId, periodType, periodStart: parsedStart } },
        update: { goalsJson: goals, periodEnd: parsedEnd },
        create: { userId, periodType, periodStart: parsedStart, periodEnd: parsedEnd, goalsJson: goals },
      })
      return NextResponse.json({ ...periodGoal, goals: safeParseJson<string[]>(periodGoal.goalsJson, []) })
    }

    // periodStart приходит от клиента и может быть смещён его часовым поясом —
    // ключ считаем через нормализацию (см. periodKeyFromStart)
    const periodKey = getPeriodKey(periodType, new Date(parsedStart.getTime() + 12 * 3600 * 1000))
    const rows = await reconcilePeriodGoals({ userId, periodType, periodKey, texts: goals })

    return NextResponse.json({
      periodType,
      periodKey,
      periodStart: parsedStart,
      periodEnd: parsedEnd,
      goals: rows.map(r => ({ id: r.id, text: r.text, completed: r.completed })),
    })
  } catch (error) {
    console.error('Error saving period goals:', error)
    return NextResponse.json({ error: 'Failed to save period goals' }, { status: 500 })
  }
}
