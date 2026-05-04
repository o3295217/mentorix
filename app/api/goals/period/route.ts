import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPeriodDates, parseDateParam, PeriodType } from '@/lib/dates'
import { safeParseJson } from '@/lib/api-utils'
import { z } from 'zod'
import { requireUserId } from '@/lib/get-user-id'
import { areTasksSimilar } from '@/lib/task-match'

const PeriodGoalSchema = z.object({
  periodType: z.enum(['week', 'month', 'quarter', 'half_year', 'year']),
  periodStart: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' }),
  periodEnd: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' }),
  goals: z.array(z.string()),
})

// Собрать все выполненные задачи за период
async function getCompletedTasksForPeriod(userId: string, start: Date, end: Date): Promise<string[]> {
  // Получаем все DailyEntry за период
  const entries = await prisma.dailyEntry.findMany({
    where: {
      userId,
      date: { gte: start, lte: end },
    },
    select: {
      selectedTasksJson: true,
      planSnapshotJson: true,
      extraTasksJson: true,
    },
  })

  const completedTexts: string[] = []

  for (const entry of entries) {
    // Получаем выбранные (выполненные) ID задач
    const selectedIds = safeParseJson<number[]>(entry.selectedTasksJson || '[]', [])
    if (selectedIds.length === 0) continue

    // Получаем снэпшот плана (это массив строк)
    const planSnapshot = safeParseJson<string[]>(entry.planSnapshotJson || '[]', [])
    
    // Получаем дополнительные задачи (могут быть также выполнены)
    const extraTasks = safeParseJson<string[]>(entry.extraTasksJson || '[]', [])

    // ID-шники соответствуют индексам в planSnapshot (1-based)
    for (const id of selectedIds) {
      if (id > 0 && id <= planSnapshot.length) {
        completedTexts.push(planSnapshot[id - 1])
      }
    }

    // Также добавляем все extraTasks (если они помечены как выполненные)
    // extraTasks обычно заполняются как выполненные по факту
    completedTexts.push(...extraTasks)
  }

  // Также проверяем закрытые OpenTask за период
  const closedTasks = await prisma.openTask.findMany({
    where: {
      userId,
      isClosed: true,
      closedAt: { gte: start, lte: end },
    },
    select: { taskText: true },
  })

  for (const task of closedTasks) {
    completedTexts.push(task.taskText)
  }

  // Проверяем Goals (tracked goals), отмеченные выполненными на странице целей
  // periodKey формируется для недели/месяца/квартала/полугодия/года внутри периода
  const completedGoals = await prisma.goal.findMany({
    where: {
      userId,
      completed: true,
    },
    select: { text: true },
  })

  for (const goal of completedGoals) {
    completedTexts.push(goal.text)
  }

  return completedTexts
}

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

    // Ищем по точному periodStart, а не по диапазону — предотвращает подтягивание чужих периодов
    const periodGoal = await prisma.periodGoal.findUnique({
      where: {
        userId_periodType_periodStart: {
          userId,
          periodType: type,
          periodStart: start,
        },
      },
    })

    const goals = periodGoal ? safeParseJson<string[]>(periodGoal.goalsJson, []) : []

    // Получаем все выполненные задачи за период для проверки целей
    const completedTasks = await getCompletedTasksForPeriod(userId, start, end)

    // Формируем объекты целей с флагом выполнения
    const goalsWithStatus = goals.map(goalText => ({
      text: goalText,
      completed: completedTasks.some(taskText => areTasksSimilar(goalText, taskText)),
    }))

    return NextResponse.json(
      periodGoal
        ? { ...periodGoal, goals: goalsWithStatus }
        : { periodType: type, periodStart: start, periodEnd: end, goals: goalsWithStatus }
    )
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

    // Upsert по unique constraint (userId, periodType, periodStart)
    const periodGoal = await prisma.periodGoal.upsert({
      where: {
        userId_periodType_periodStart: {
          userId,
          periodType,
          periodStart: parsedStart,
        },
      },
      update: {
        goalsJson: goals,
        periodEnd: parsedEnd,
      },
      create: {
        userId,
        periodType,
        periodStart: parsedStart,
        periodEnd: parsedEnd,
        goalsJson: goals,
      },
    })

    return NextResponse.json({ ...periodGoal, goals: safeParseJson<string[]>(periodGoal.goalsJson, []) })
  } catch (error) {
    console.error('Error creating period goals:', error)
    return NextResponse.json({ error: 'Failed to create period goals' }, { status: 500 })
  }
}
