import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId(request)
    const { id } = await params
    const numericId = parseInt(id)
    
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    // Проверяем принадлежность задачи пользователю
    const existing = await prisma.openTask.findFirst({
      where: { id: numericId, userId }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const task = await prisma.openTask.update({
      where: { id: numericId },
      data: {
        isClosed: false,
        closedAt: null,
      },
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error reopening task:', error)
    return NextResponse.json({ error: 'Failed to reopen task' }, { status: 500 })
  }
}
