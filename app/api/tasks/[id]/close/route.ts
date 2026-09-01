import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'
import { completeTrackedGoalsForTasks } from '@/lib/goal-completion-sync'
import { recalculateWorkSummary } from '@/lib/completed-work'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId(request)
    const { id } = await params
    const numericId = parseInt(id)
    
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    // Сначала проверяем, что задача принадлежит пользователю
    const existingTask = await prisma.openTask.findFirst({
      where: { id: numericId, userId },
    })

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const task = await prisma.openTask.update({
      where: { id: numericId },
      data: {
        isClosed: true,
        archiveStatus: 'completed',
        closedAt: new Date(),
      },
    })

    // Взаимная связь: закрытая задача отмечает совпавшую tracked-цель
    try {
      const completedGoals = await completeTrackedGoalsForTasks({
        userId,
        date: task.closedAt ?? new Date(),
        taskTexts: [task.taskText],
      })
      if (completedGoals > 0) {
        await recalculateWorkSummary(userId, task.closedAt ?? new Date())
      }
    } catch (gsError) {
      console.error('[GoalSync] failed:', gsError)
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error closing task:', error)
    return NextResponse.json({ error: 'Failed to close task' }, { status: 500 })
  }
}
