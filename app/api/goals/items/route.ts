import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { parseDateParam } from '@/lib/dates'
import { safeParseJson } from '@/lib/api-utils'
import { requireUserId } from '@/lib/get-user-id'
import { syncCompletedWorkForGoal, removeCompletedWorkForGoal } from '@/lib/completed-work'

// Конвертация числа приоритета в строку
const priorityNumToStr = (num: number): string => {
  switch (num) {
    case 2: return 'high'
    case 1: return 'medium'
    default: return 'none'
  }
}

// Конвертация строки приоритета в число
const priorityStrToNum = (str: string): number => {
  switch (str) {
    case 'high': return 2
    case 'medium': return 1
    default: return 0
  }
}

// GET - получить цели по периоду
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const searchParams = request.nextUrl.searchParams
    const periodType = searchParams.get('periodType')
    const periodKey = searchParams.get('periodKey')

    const where: Prisma.GoalWhereInput = { userId }
    if (periodType) where.periodType = periodType
    if (periodKey) where.periodKey = periodKey

    const goals = await prisma.goal.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json(goals.map(g => ({
      ...g,
      priority: priorityStrToNum(g.priority),
      tags: safeParseJson<string[]>(g.tagsJson, []),
      blockedBy: safeParseJson<number[]>(g.blockedByJson, []),
      history: safeParseJson<Array<{ type: string; date: string }>>(g.historyJson, []),
    })))
  } catch (error) {
    const statusCode = (error as any)?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error fetching goals:', error)
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
  }
}

// POST - создать новую цель
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    const { text, periodType, periodKey, deadline, priority, tags } = body

    // priority приходит как число (0-3), конвертируем в строку
    const priorityStr = typeof priority === 'number' ? priorityNumToStr(priority) : (priority || 'none')

    const goal = await prisma.goal.create({
      data: {
        userId,
        text,
        periodType,
        periodKey,
        deadline: deadline ? parseDateParam(deadline) : null,
        priority: priorityStr,
        tagsJson: JSON.stringify(tags || []),
        historyJson: JSON.stringify([{
          type: 'created',
          date: new Date().toISOString(),
        }]),
      },
    })

    return NextResponse.json({
      ...goal,
      priority: priorityStrToNum(goal.priority),
      tags: safeParseJson<string[]>(goal.tagsJson, []),
      blockedBy: safeParseJson<number[]>(goal.blockedByJson, []),
      history: safeParseJson<Array<{ type: string; date: string }>>(goal.historyJson, []),
    })
  } catch (error) {
    const statusCode = (error as any)?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error creating goal:', error)
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
  }
}

// PUT - обновить цель
export async function PUT(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    const { id, text, completed, deadline, priority, tags, blockedBy, sortOrder } = body

    const existingGoal = await prisma.goal.findFirst({ where: { id, userId } })
    if (!existingGoal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    const history = safeParseJson<Array<{ type: string; date: string }>>(existingGoal.historyJson, [])
    
    // Добавляем событие в историю при изменении статуса
    if (completed !== undefined && completed !== existingGoal.completed) {
      history.push({
        type: completed ? 'completed' : 'uncompleted',
        date: new Date().toISOString(),
      })
    }

    // Конвертируем priority из числа в строку если нужно
    const priorityStr = priority !== undefined 
      ? (typeof priority === 'number' ? priorityNumToStr(priority) : priority)
      : undefined

    const goal = await prisma.goal.update({
      where: { id },
      data: {
        ...(text !== undefined && { text }),
        ...(completed !== undefined && { 
          completed, 
          completedAt: completed ? new Date() : null 
        }),
        ...(deadline !== undefined && { deadline: deadline ? parseDateParam(deadline) : null }),
        ...(priorityStr !== undefined && { priority: priorityStr }),
        ...(tags !== undefined && { tagsJson: JSON.stringify(tags) }),
        ...(blockedBy !== undefined && { blockedByJson: JSON.stringify(blockedBy) }),
        ...(sortOrder !== undefined && { sortOrder }),
        historyJson: JSON.stringify(history),
      },
    })

    // Синхронизация CompletedWork при изменении статуса выполнения
    if (completed !== undefined && completed !== existingGoal.completed) {
      try {
        if (completed) {
          await syncCompletedWorkForGoal({
            userId,
            goalId: goal.id,
            goalText: goal.text,
            periodKey: goal.periodKey,
            completedAt: goal.completedAt || new Date(),
          })
        } else {
          await removeCompletedWorkForGoal(userId, goal.id)
        }
      } catch (cwError) {
        console.error('[CompletedWork] goal sync failed:', cwError)
      }
    }

    return NextResponse.json({
      ...goal,
      priority: priorityStrToNum(goal.priority),
      tags: safeParseJson<string[]>(goal.tagsJson, []),
      blockedBy: safeParseJson<number[]>(goal.blockedByJson, []),
      history: safeParseJson<Array<{ type: string; date: string }>>(goal.historyJson, []),
    })
  } catch (error) {
    const statusCode = (error as any)?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error updating goal:', error)
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 })
  }
}

// DELETE - удалить цель
export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const numericId = parseInt(id)
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid goal ID' }, { status: 400 })
    }

    // Проверяем, что цель принадлежит пользователю
    const existing = await prisma.goal.findFirst({ where: { id: numericId, userId } })
    if (!existing) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    // Отвязываем CompletedWork записи (факт работы сохраняется, но sourceId обнуляется)
    await prisma.completedWork.updateMany({
      where: { userId, sourceType: 'goal', sourceId: numericId },
      data: { sourceId: 0 },
    })

    await prisma.goal.delete({ where: { id: numericId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    const statusCode = (error as any)?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error deleting goal:', error)
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 })
  }
}
