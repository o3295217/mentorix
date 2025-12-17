import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDateParam } from '@/lib/dates'
import { areTasksSimilar } from '@/lib/task-match'

async function removeSuggestedTaskFromEvaluation(params: {
  originDate: string
  taskText: string
}): Promise<void> {
  const date = parseDateParam(params.originDate)
  const dailyEntry = await prisma.dailyEntry.findUnique({
    where: { date },
    include: { evaluation: true },
  })

  const evaluation = dailyEntry?.evaluation
  if (!evaluation?.suggestedTasksJson) return

  let parsed: unknown
  try {
    parsed = JSON.parse(evaluation.suggestedTasksJson)
  } catch {
    return
  }

  if (!Array.isArray(parsed)) return

  const filtered = parsed.filter((t) => {
    if (!t || typeof t !== 'object') return false
    const taskText = (t as { taskText?: unknown }).taskText
    if (typeof taskText !== 'string') return true
    return !areTasksSimilar(taskText, params.taskText)
  })

  const newJson = filtered.length > 0 ? JSON.stringify(filtered) : null
  if (newJson === evaluation.suggestedTasksJson) return

  await prisma.evaluation.update({
    where: { id: evaluation.id },
    data: { suggestedTasksJson: newJson },
  })
}

export async function POST(request: NextRequest) {
  try {
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
      where: { isClosed: false },
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
      await removeSuggestedTaskFromEvaluation({ originDate, taskText })
      return NextResponse.json(
        { error: 'Task already exists', task: existingTask },
        { status: 409 }
      )
    }

    // Создать задачу
    const task = await prisma.openTask.create({
      data: {
        taskText,
        taskType,
        originDate: parseDateParam(originDate),
      },
    })

    await removeSuggestedTaskFromEvaluation({ originDate, taskText })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error adding suggested task:', error)
    return NextResponse.json(
      { error: 'Failed to add suggested task' },
      { status: 500 }
    )
  }
}
