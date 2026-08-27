import { describe, expect, it } from 'vitest'
import { getDailyChatMessageAnchorId, getDailyPlanCounters } from '@/app/daily/page'
import { getDailyPhase } from '@/hooks/daily/phase-helpers'
import type { Habit } from '@/hooks/daily/types'
import type { OpenTask } from '@/lib/types'

function makeTask(id: number, taskText: string): OpenTask {
  return {
    id,
    taskText,
    taskType: 'operational',
    originDate: '2026-08-11',
    isClosed: false,
    createdAt: '2026-08-11T00:00:00.000Z',
  }
}

function makeHabit(id: number, taskText: string): Habit {
  return {
    id,
    taskText,
    frequency: 'daily',
    daysOfWeek: null,
    interval: null,
    isActive: true,
    streak: 0,
    bestStreak: 0,
    totalDone: 0,
    sortOrder: id,
  }
}

describe('daily plan counters', () => {
  it('counts only work tasks in the visible counter and keeps all tasks for daily phase', () => {
    const tasks = [
      makeTask(1, 'Закрыть отчёт'),
      makeTask(2, 'Созвон с клиентом'),
      makeTask(3, 'Зарядка'),
      makeTask(4, 'Душ'),
      makeTask(5, 'Завтрак'),
    ]
    const habits = [makeHabit(1, 'зарядка'), makeHabit(2, 'душ'), makeHabit(3, 'завтрак')]
    const selectedTasks = new Set([1, 3, 4])

    const counters = getDailyPlanCounters(tasks, selectedTasks, habits)

    expect(counters.workCompletedCount).toBe(1)
    expect(counters.workTotalCount).toBe(2)
    expect(counters.workCompletionPercent).toBe(50)
    expect(counters.habitCompletedCount).toBe(2)
    expect(counters.habitTotalCount).toBe(3)
    expect(counters.completedCount).toBe(3)
    expect(counters.totalCount).toBe(5)

    expect(
      getDailyPhase({
        selectedDate: '2026-08-11',
        todayDate: '2026-08-11',
        savedTaskCount: 5,
        totalTaskCount: counters.totalCount,
        completedTaskCount: counters.completedCount,
        currentMinutes: 12 * 60,
        workStartMinutes: 9 * 60,
        workEndMinutes: 18 * 60,
      }),
    ).toBe('execution')
  })
})

describe('getDailyChatMessageAnchorId', () => {
  it('builds a stable DOM anchor id from a persisted chat message id', () => {
    expect(getDailyChatMessageAnchorId('55')).toBe('daily-chat-message-55')
    expect(getDailyChatMessageAnchorId('local-user-1-abc')).toBe('daily-chat-message-local-user-1-abc')
  })
})
