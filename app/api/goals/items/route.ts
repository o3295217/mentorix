import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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
    const searchParams = request.nextUrl.searchParams
    const periodType = searchParams.get('periodType')
    const periodKey = searchParams.get('periodKey')

    const where: Prisma.GoalWhereInput = {}
    if (periodType) where.periodType = periodType
    if (periodKey) where.periodKey = periodKey

    const goals = await prisma.goal.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json(goals.map(g => ({
      ...g,
      priority: priorityStrToNum(g.priority),
      tags: JSON.parse(g.tagsJson),
      blockedBy: JSON.parse(g.blockedByJson),
      history: JSON.parse(g.historyJson),
    })))
  } catch (error) {
    console.error('Error fetching goals:', error)
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
  }
}

// POST - создать новую цель
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, periodType, periodKey, deadline, priority, tags } = body

    // priority приходит как число (0-3), конвертируем в строку
    const priorityStr = typeof priority === 'number' ? priorityNumToStr(priority) : (priority || 'none')

    const goal = await prisma.goal.create({
      data: {
        text,
        periodType,
        periodKey,
        deadline: deadline ? new Date(deadline) : null,
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
      tags: JSON.parse(goal.tagsJson),
      blockedBy: JSON.parse(goal.blockedByJson),
      history: JSON.parse(goal.historyJson),
    })
  } catch (error) {
    console.error('Error creating goal:', error)
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
  }
}

// PUT - обновить цель
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, text, completed, deadline, priority, tags, blockedBy, sortOrder } = body

    const existingGoal = await prisma.goal.findUnique({ where: { id } })
    if (!existingGoal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    const history = JSON.parse(existingGoal.historyJson)
    
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
        ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
        ...(priorityStr !== undefined && { priority: priorityStr }),
        ...(tags !== undefined && { tagsJson: JSON.stringify(tags) }),
        ...(blockedBy !== undefined && { blockedByJson: JSON.stringify(blockedBy) }),
        ...(sortOrder !== undefined && { sortOrder }),
        historyJson: JSON.stringify(history),
      },
    })

    return NextResponse.json({
      ...goal,
      priority: priorityStrToNum(goal.priority),
      tags: JSON.parse(goal.tagsJson),
      blockedBy: JSON.parse(goal.blockedByJson),
      history: JSON.parse(goal.historyJson),
    })
  } catch (error) {
    console.error('Error updating goal:', error)
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 })
  }
}

// DELETE - удалить цель
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const numericId = parseInt(id)
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid goal ID' }, { status: 400 })
    }

    await prisma.goal.delete({ where: { id: numericId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting goal:', error)
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 })
  }
}
