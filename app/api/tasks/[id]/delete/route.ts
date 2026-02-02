import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId(request)
    const { id } = await params
    const taskId = parseInt(id, 10)

    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    // Проверяем, что задача принадлежит пользователю
    const task = await prisma.openTask.findFirst({
      where: { id: taskId, userId }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Удаляем задачу
    await prisma.openTask.delete({
      where: { id: taskId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
