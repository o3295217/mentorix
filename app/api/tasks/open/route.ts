import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { parseDateParam } from '@/lib/dates'
import { requireUserId } from '@/lib/get-user-id'

const OpenTaskSchema = z.object({
  taskText: z.string().min(1, "Task text is required"),
  taskType: z.enum(['strategic', 'operational']),
  originDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
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

    const { taskText, taskType, originDate } = validation.data

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
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
