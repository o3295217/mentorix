import { describe, expect, it } from 'vitest'
import { getTaskTimeChipLabel, getTaskTimeChips, sortTasksByScheduleTime } from '@/hooks/daily/list-lens-helpers'
import { buildTasksFromTexts } from '@/hooks/daily/task-helpers'
import type { DailySchedule } from '@/lib/daily-schedule'

describe('daily list lens helpers', () => {
  const schedule: DailySchedule = {
    version: 3,
    timezone: 'Europe/Moscow',
    dayStartMinutes: 360,
    dayEndMinutes: 1320,
    planningBasis: 'day_start',
    planningStartMinutes: 540,
    workEndMinutes: 1080,
    activityEndMinutes: 1320,
    blocks: [
      { id: 'b2', kind: 'task', taskIndex: 2, taskText: 'Вторая', category: 'main', isFixed: false, startMinutes: 600, durationMinutes: 30 },
      { id: 'b1', kind: 'task', taskIndex: 1, taskText: 'Первая', category: 'main', isFixed: false, startMinutes: 540, durationMinutes: 45 },
      { id: 'b2-later', kind: 'task', taskIndex: 2, taskText: 'Вторая', category: 'main', isFixed: false, startMinutes: 720, durationMinutes: 30 },
      { id: 'meal', kind: 'meal', title: 'Обед', category: 'meal', isFixed: true, startMinutes: 780, durationMinutes: 45 },
    ],
  }

  it('builds first time chip with extra block count', () => {
    const chips = getTaskTimeChips(schedule)

    expect(getTaskTimeChipLabel(chips.get(1))).toBe('09:00–09:45 · 45 мин')
    // Длительность в чипе — суммарная по всем блокам задачи (30 + 30)
    expect(getTaskTimeChipLabel(chips.get(2))).toBe('10:00–10:30 +1 · 1 ч')
  })

  it('sorts tasks by first scheduled block and keeps unscheduled tasks last', () => {
    const tasks = buildTasksFromTexts(['Первая', 'Вторая', 'Третья'], '2026-07-24')
    const sorted = sortTasksByScheduleTime(tasks, getTaskTimeChips(schedule))

    expect(sorted.map(task => task.taskText)).toEqual(['Первая', 'Вторая', 'Третья'])
  })

  it('uses original plan indexes when sorting a filtered task subset', () => {
    const tasks = buildTasksFromTexts(['Первая', 'Вторая', 'Третья'], '2026-07-24')
    const subset = [tasks[2], tasks[1]]
    const sorted = sortTasksByScheduleTime(subset, getTaskTimeChips(schedule), tasks)

    expect(sorted.map(task => task.taskText)).toEqual(['Вторая', 'Третья'])
  })
})
