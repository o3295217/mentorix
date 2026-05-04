import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { parseDateParam } from '@/lib/dates'
import { areTasksSimilar } from '@/lib/task-match'
import { requireUserId } from '@/lib/get-user-id'
import { safeParseJson } from '@/lib/api-utils'

type SuggestedTaskJson = { taskText?: unknown }

async function removeSuggestedTaskFromEvaluation(params: {
  userId: string
  originDate: string
  taskText: string
}): Promise<void> {
  const date = parseDateParam(params.originDate)
  const dailyEntry = await prisma.dailyEntry.findFirst({
    where: { userId: params.userId, date },
    include: { evaluation: true },
  })

  const evaluation = dailyEntry?.evaluation
  if (!evaluation?.suggestedTasksJson) return

  const parsed = safeParseJson<SuggestedTaskJson[]>(evaluation.suggestedTasksJson, [])

  const filtered = parsed.filter((t) => {
    if (!t || typeof t !== 'object') return false
    const taskText = t.taskText
    if (typeof taskText !== 'string') return true
    return !areTasksSimilar(taskText, params.taskText)
  })

  if (filtered.length === parsed.length) return

  await prisma.evaluation.update({
    where: { id: evaluation.id },
    data: {
      suggestedTasksJson: filtered.length > 0
        ? filtered as unknown as Prisma.InputJsonValue
        : Prisma.DbNull,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    const { taskText, taskType, originDate } = body

    if (!taskText || !taskType || !originDate) {
      return NextResponse.json(
        { error: 'taskText, taskType, and originDate are required' },
        { status: 400 }
      )
    }

    // Проверить, нет ли уже похожей незакрытой задачи
    const openTasks = await prisma.openTask.findMany({
      where: { userId, isClosed: false },
      select: {
        id: true,
        taskText: true,
        taskType: true,
        originDate: true,
        isClosed: true,
        closedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const existingTask = openTasks.find((t) => areTasksSimilar(t.taskText, taskText))

    // Важно: даже если задача уже есть, убираем её из блока "Предложенные" (семантика "переноса")
    if (existingTask) {
      await removeSuggestedTaskFromEvaluation({ userId, originDate, taskText })
      return NextResponse.json(
        { error: 'Task already exists', task: existingTask },
        { status: 409 }
      )
    }

    // Создать задачу
    const task = await prisma.openTask.create({
      data: {
        userId,
        taskText,
        taskType,
        originDate: parseDateParam(originDate),
      },
    })

    await removeSuggestedTaskFromEvaluation({ userId, originDate, taskText })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error adding suggested task:', error)
    return NextResponse.json(
      { error: 'Failed to add suggested task' },
      { status: 500 }
    )
  }
}
