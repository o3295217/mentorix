import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    // Проверить, нет ли уже такой задачи
    const existingTask = await prisma.openTask.findFirst({
      where: {
        taskText,
        isClosed: false,
      },
    })

    if (existingTask) {
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
        originDate: new Date(originDate),
      },
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error adding suggested task:', error)
    return NextResponse.json(
      { error: 'Failed to add suggested task' },
      { status: 500 }
    )
  }
}
