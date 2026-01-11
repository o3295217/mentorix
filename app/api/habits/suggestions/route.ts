import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDateParam, toDateKey } from '@/lib/dates'
import { requireUserId } from '@/lib/get-user-id'

interface TaskFrequency {
  text: string
  count: number
  consecutiveDays: number
  lastDate: string
}

// GET - получить предложения на основе истории
// Ищет задачи которые повторялись 3+ дня подряд
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const searchParams = request.nextUrl.searchParams
    const dateStr = searchParams.get('date') || toDateKey(new Date())
    const targetDate = parseDateParam(dateStr)

    // Получить записи за последние 14 дней
    const twoWeeksAgo = new Date(targetDate)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    const entries = await prisma.dailyEntry.findMany({
      where: {
        userId,
        date: {
          gte: twoWeeksAgo,
          lt: targetDate,
        },
        planText: { not: null },
      },
      orderBy: { date: 'desc' },
    })

    // Получить существующие привычки
    const existingHabits = await prisma.habit.findMany({
      where: { userId, isActive: true },
    })
    const existingHabitTexts = new Set(
      existingHabits.map(h => normalizeTaskText(h.taskText))
    )

    // Подсчитать частоту задач
    const taskMap = new Map<string, TaskFrequency>()

    entries.forEach(entry => {
      if (!entry.planText) return
      
      const tasks = entry.planText.split('\n').filter(t => t.trim())
      const dateKey = toDateKey(entry.date)
      
      tasks.forEach(task => {
        const normalized = normalizeTaskText(task)
        if (!normalized) return
        
        // Пропустить если уже есть как привычка
        if (existingHabitTexts.has(normalized)) return
        
        const existing = taskMap.get(normalized)
        if (existing) {
          existing.count++
          // Проверяем последовательность дней
          const lastDateObj = parseDateParam(existing.lastDate)
          const currentDateObj = parseDateParam(dateKey)
          const diffDays = Math.abs(
            (lastDateObj.getTime() - currentDateObj.getTime()) / (1000 * 60 * 60 * 24)
          )
          
          if (diffDays <= 1) {
            existing.consecutiveDays++
          }
          
          if (dateKey > existing.lastDate) {
            existing.lastDate = dateKey
          }
        } else {
          taskMap.set(normalized, {
            text: task.trim(),
            count: 1,
            consecutiveDays: 1,
            lastDate: dateKey,
          })
        }
      })
    })

    // Фильтровать задачи с 3+ последовательными днями или 5+ повторениями
    const suggestions: Array<{
      text: string
      consecutiveDays: number
      totalCount: number
      reason: string
    }> = []

    taskMap.forEach((freq, _normalized) => {
      if (freq.consecutiveDays >= 3) {
        suggestions.push({
          text: freq.text,
          consecutiveDays: freq.consecutiveDays,
          totalCount: freq.count,
          reason: `${freq.consecutiveDays} дней подряд`,
        })
      } else if (freq.count >= 5) {
        suggestions.push({
          text: freq.text,
          consecutiveDays: freq.consecutiveDays,
          totalCount: freq.count,
          reason: `${freq.count} раз за 2 недели`,
        })
      }
    })

    // Сортировать по последовательности, потом по частоте
    suggestions.sort((a, b) => {
      if (b.consecutiveDays !== a.consecutiveDays) {
        return b.consecutiveDays - a.consecutiveDays
      }
      return b.totalCount - a.totalCount
    })

    return NextResponse.json({
      suggestions: suggestions.slice(0, 5), // Максимум 5 предложений
      analyzed: entries.length,
    })
  } catch (error) {
    console.error('Error getting habit suggestions:', error)
    return NextResponse.json({ error: 'Failed to get suggestions' }, { status: 500 })
  }
}

// Нормализация текста задачи для сравнения
function normalizeTaskText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Убрать emoji
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    // Убрать нумерацию в начале
    .replace(/^\d+[.)\s-]+/, '')
    // Убрать чекбоксы
    .replace(/^(\[|\]|☐|☑|✓|✅|❌|\s)+/, '')
    // Убрать лишние пробелы
    .replace(/\s+/g, ' ')
    .trim()
}
