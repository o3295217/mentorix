import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { parseDateParam } from '@/lib/dates'
import { requireUserId } from '@/lib/get-user-id'
import { areTasksSimilar } from '@/lib/task-match'

const OpenTaskSchema = z.object({
  taskText: z.string().min(1, "Task text is required"),
  taskType: z.enum(['strategic', 'operational']),
  originDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  forceCreate: z.boolean().optional(), // Пропустить проверку на похожие
})

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const tasks = await prisma.openTask.findMany({
      where: { userId, isClosed: false },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(tasks)
  } catch (error) {
    const statusCode = (error as any)?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error fetching open tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch open tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    
    const validation = OpenTaskSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { taskText, taskType, originDate, forceCreate } = validation.data

    // Проверяем на похожие открытые задачи (если не forceCreate)
    if (!forceCreate) {
      const existingTasks = await prisma.openTask.findMany({
        where: { userId, isClosed: false },
        select: { id: true, taskText: true, originDate: true },
      })
      
      const similarTasks = existingTasks.filter(t => areTasksSimilar(t.taskText, taskText))
      
      if (similarTasks.length > 0) {
        return NextResponse.json({
          warning: 'similar_tasks_found',
          similarTasks: similarTasks.map(t => ({
            id: t.id,
            taskText: t.taskText,
            originDate: t.originDate,
          })),
          message: `Найдено ${similarTasks.length} похожих задач. Создать новую или закрыть старые?`,
        }, { status: 409 }) // Conflict
      }
    }

    const task = await prisma.openTask.create({
      data: {
        userId,
        taskText,
        taskType,
        originDate: parseDateParam(originDate),
      },
    })

    return NextResponse.json(task)
  } catch (error) {
    const statusCode = (error as any)?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
