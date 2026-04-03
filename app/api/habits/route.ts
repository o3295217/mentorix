import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeParseJson } from '@/lib/api-utils'
import { z } from 'zod'
import { parseDateParam } from '@/lib/dates'
import { requireUserId } from '@/lib/get-user-id'

const HabitSchema = z.object({
  taskText: z.string().trim().min(1).max(500),
  frequency: z.enum(['daily', 'weekdays', 'weekends', 'weekly', 'custom']).default('daily'),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).max(7).optional(), // 1=пн, 7=вс
  interval: z.number().int().min(1).max(365).optional(),
  isActive: z.boolean().default(true),
})

const HabitUpdateSchema = HabitSchema.partial().extend({
  id: z.coerce.number().int().positive(),
  streak: z.coerce.number().int().min(0).max(100000).optional(),
  bestStreak: z.coerce.number().int().min(0).max(100000).optional(),
  totalDone: z.coerce.number().int().min(0).max(100000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
})

// GET - получить все активные привычки + какие нужны сегодня
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const searchParams = request.nextUrl.searchParams
    const dateStr = searchParams.get('date')
    
    // Получить все активные привычки
    const habits = await prisma.habit.findMany({
      where: { userId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    // Если запрошена дата - фильтруем по дню недели
    if (dateStr) {
      const date = parseDateParam(dateStr)
      const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay() // 1=пн, 7=вс
      
      const habitsForToday = habits.filter(habit => {
        switch (habit.frequency) {
          case 'daily':
            return true
          case 'weekdays':
            return dayOfWeek >= 1 && dayOfWeek <= 5
          case 'weekends':
            return dayOfWeek === 6 || dayOfWeek === 7
          case 'weekly': {
            // По умолчанию понедельник, или первый день из daysOfWeek
            const days = safeParseJson<number[]>(habit.daysOfWeek, [1])
            return days.includes(dayOfWeek)
          }
          case 'custom': {
            const customDays = safeParseJson<number[]>(habit.daysOfWeek, [])
            return customDays.length === 0 || customDays.includes(dayOfWeek)
          }
          default:
            return true
        }
      })

      return NextResponse.json({
        habits: habitsForToday,
        all: habits,
      })
    }

    return NextResponse.json({ habits, all: habits })
  } catch (error) {
    console.error('Error fetching habits:', error)
    return NextResponse.json({ error: 'Failed to fetch habits' }, { status: 500 })
  }
}

// POST - создать новую привычку
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    
    const validation = HabitSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { taskText, frequency, daysOfWeek, interval, isActive } = validation.data

    // Получить максимальный sortOrder для этого пользователя
    const maxSort = await prisma.habit.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    })

    const habit = await prisma.habit.create({
      data: {
        userId,
        taskText,
        frequency,
        daysOfWeek: daysOfWeek ? JSON.stringify(daysOfWeek) : null,
        interval,
        isActive,
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
      },
    })

    return NextResponse.json(habit)
  } catch (error) {
    console.error('Error creating habit:', error)
    return NextResponse.json({ error: 'Failed to create habit' }, { status: 500 })
  }
}

// PUT - обновить привычку
export async function PUT(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const validation = HabitUpdateSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { id, ...data } = validation.data

    // Проверяем, что привычка принадлежит пользователю
    const existing = await prisma.habit.findFirst({
      where: { id, userId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    
    if (data.taskText !== undefined) updateData.taskText = data.taskText
    if (data.frequency !== undefined) updateData.frequency = data.frequency
    if (data.daysOfWeek !== undefined) updateData.daysOfWeek = JSON.stringify(data.daysOfWeek)
    if (data.interval !== undefined) updateData.interval = data.interval
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.streak !== undefined) updateData.streak = data.streak
    if (data.bestStreak !== undefined) updateData.bestStreak = data.bestStreak
    if (data.totalDone !== undefined) updateData.totalDone = data.totalDone
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder

    const habit = await prisma.habit.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(habit)
  } catch (error) {
    console.error('Error updating habit:', error)
    return NextResponse.json({ error: 'Failed to update habit' }, { status: 500 })
  }
}

// DELETE - удалить привычку (или деактивировать)
export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')
    const soft = searchParams.get('soft') === 'true'

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    // Проверяем, что привычка принадлежит пользователю
    const existing = await prisma.habit.findFirst({
      where: { id: parseInt(id), userId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 })
    }

    if (soft) {
      // Мягкое удаление - деактивация
      await prisma.habit.update({
        where: { id: parseInt(id) },
        data: { isActive: false },
      })
    } else {
      // Жесткое удаление
      await prisma.habit.delete({
        where: { id: parseInt(id) },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting habit:', error)
    return NextResponse.json({ error: 'Failed to delete habit' }, { status: 500 })
  }
}
