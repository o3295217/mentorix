import { prisma } from '@/lib/prisma'
import { splitLines, safeParseJsonArray } from '@/lib/fact-utils'
import { getISOWeek, startOfWeek, format } from 'date-fns'

// Определить категорию задачи (переиспользуем логику из user-stats)
export function getTaskCategory(text: string): string {
  const lower = text.toLowerCase()

  if (lower.includes('подъём') || lower.includes('подъем') ||
      lower.includes('зарядка') || lower.includes('душ') ||
      lower.includes('начало работы') || lower.match(/^\d{1,2}:\d{2}/)) {
    return 'привычки'
  }

  if (lower.includes('оперативка') || lower.includes('созвон') ||
      lower.includes('встреча') || lower.includes('звонок')) {
    return 'созвоны'
  }

  if (lower.includes('стратег') || lower.includes('бюджет') ||
      lower.includes('планирование') || lower.includes('анализ') ||
      lower.includes('разработка') || lower.includes('проект')) {
    return 'стратегические'
  }

  return 'операционные'
}

// Получить periodKey для даты
export function getWeekKey(date: Date): string {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const year = weekStart.getFullYear()
  const week = getISOWeek(weekStart)
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function getMonthKey(date: Date): string {
  return format(date, 'yyyy-MM')
}

export function getQuarterKey(date: Date): string {
  const q = Math.ceil((date.getMonth() + 1) / 3)
  return `${date.getFullYear()}-Q${q}`
}

// Записать выполненные задачи из DailyEntry в CompletedWork
export async function syncCompletedWorkForEntry(params: {
  userId: string
  entryId: number
  date: Date
  planText: string | null
  selectedTasksJson: string | null
  extraTasksJson: string | null
}): Promise<void> {
  const { userId, entryId, date, planText, selectedTasksJson, extraTasksJson } = params

  const planTasks = splitLines(planText)
  const selectedIds = safeParseJsonArray<string | number>(selectedTasksJson)
    .map(id => Number(id))
    .filter(id => Number.isInteger(id) && id > 0 && id <= planTasks.length)

  const extraTasks = safeParseJsonArray<string>(extraTasksJson).filter(Boolean)

  // Удаляем старые записи для этого entry (idempotent)
  await prisma.completedWork.deleteMany({
    where: { userId, sourceType: 'dailyEntry', sourceId: entryId },
  })

  const records: Array<{
    userId: string
    date: Date
    type: string
    text: string
    category: string
    sourceType: string
    sourceId: number
  }> = []

  // Выполненные задачи из плана
  for (const id of selectedIds) {
    const text = planTasks[id - 1]
    if (text) {
      records.push({
        userId,
        date,
        type: 'task',
        text,
        category: getTaskCategory(text),
        sourceType: 'dailyEntry',
        sourceId: entryId,
      })
    }
  }

  // Экстра-задачи
  for (const text of extraTasks) {
    records.push({
      userId,
      date,
      type: 'extra',
      text,
      category: getTaskCategory(text),
      sourceType: 'dailyEntry',
      sourceId: entryId,
    })
  }

  if (records.length > 0) {
    await prisma.completedWork.createMany({ data: records })
  }
}

// Записать выполнение цели в CompletedWork
export async function syncCompletedWorkForGoal(params: {
  userId: string
  goalId: number
  goalText: string
  periodKey: string
  completedAt: Date
}): Promise<void> {
  const { userId, goalId, goalText, periodKey, completedAt } = params

  // Удаляем старую запись (idempotent)
  await prisma.completedWork.deleteMany({
    where: { userId, sourceType: 'goal', sourceId: goalId },
  })

  await prisma.completedWork.create({
    data: {
      userId,
      date: completedAt,
      type: 'goal',
      text: goalText,
      category: 'стратегические',
      goalLink: periodKey,
      sourceType: 'goal',
      sourceId: goalId,
    },
  })
}

// Удалить запись о выполнении цели (если uncomplete)
export async function removeCompletedWorkForGoal(userId: string, goalId: number): Promise<void> {
  await prisma.completedWork.deleteMany({
    where: { userId, sourceType: 'goal', sourceId: goalId },
  })
}

// Пересчитать WorkSummary для недели по дате
export async function recalculateWorkSummary(userId: string, date: Date): Promise<void> {
  const weekKey = getWeekKey(date)
  const monthKey = getMonthKey(date)

  // Пересчитываем неделю
  await recalculateWorkSummaryForPeriod(userId, 'week', weekKey, date)
  // Пересчитываем месяц
  await recalculateWorkSummaryForPeriod(userId, 'month', monthKey, date)
}

async function recalculateWorkSummaryForPeriod(
  userId: string,
  periodType: string,
  periodKey: string,
  refDate: Date
): Promise<void> {
  // Определяем границы периода
  let startDate: Date
  let endDate: Date

  if (periodType === 'week') {
    startDate = startOfWeek(refDate, { weekStartsOn: 1 })
    endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 7)
  } else {
    // month
    startDate = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
    endDate = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1)
  }

  const items = await prisma.completedWork.findMany({
    where: {
      userId,
      date: { gte: startDate, lt: endDate },
    },
    orderBy: { date: 'asc' },
  })

  const tasksCompleted = items.filter(i => i.type === 'task' || i.type === 'extra').length
  const goalsCompleted = items.filter(i => i.type === 'goal').length

  // Подсчёт по категориям
  const catCounts: Record<string, number> = {}
  for (const item of items) {
    const cat = item.category || 'другое'
    catCounts[cat] = (catCounts[cat] || 0) + 1
  }

  // Ключевые достижения — стратегические задачи и цели
  const achievements = items
    .filter(i => i.type === 'goal' || i.category === 'стратегические')
    .map(i => i.text)
    .slice(0, 10)

  // Генерируем текстовую сводку
  const summaryParts: string[] = []
  summaryParts.push(`${periodType === 'week' ? 'Неделя' : 'Месяц'} ${periodKey}: ${items.length} задач выполнено`)
  if (goalsCompleted > 0) summaryParts.push(`${goalsCompleted} целей достигнуто`)
  if (achievements.length > 0) {
    summaryParts.push(`Ключевое: ${achievements.slice(0, 5).join('; ')}`)
  }
  const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
  if (topCats.length > 0) {
    summaryParts.push(`Фокус: ${topCats.map(([cat, cnt]) => `${cat} (${cnt})`).join(', ')}`)
  }

  await prisma.workSummary.upsert({
    where: {
      userId_periodType_periodKey: { userId, periodType, periodKey },
    },
    create: {
      userId,
      periodType,
      periodKey,
      summaryText: summaryParts.join('. '),
      keyAchievements: JSON.stringify(achievements),
      tasksCompleted,
      goalsCompleted,
      topCategoriesJson: JSON.stringify(catCounts),
    },
    update: {
      summaryText: summaryParts.join('. '),
      keyAchievements: JSON.stringify(achievements),
      tasksCompleted,
      goalsCompleted,
      topCategoriesJson: JSON.stringify(catCounts),
    },
  })
}

// Получить контекст выполненной работы для промпта ИИ
export async function getWorkContextForAI(userId: string, currentDate: Date): Promise<string> {
  const weekKey = getWeekKey(currentDate)
  const monthKey = getMonthKey(currentDate)
  const prevWeekDate = new Date(currentDate)
  prevWeekDate.setDate(prevWeekDate.getDate() - 7)
  const prevWeekKey = getWeekKey(prevWeekDate)

  // Текущая неделя — детально
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const currentWeekItems = await prisma.completedWork.findMany({
    where: {
      userId,
      date: { gte: weekStart, lt: weekEnd },
    },
    orderBy: { date: 'asc' },
  })

  // Сводки за прошлую неделю и прошлый месяц
  const summaries = await prisma.workSummary.findMany({
    where: {
      userId,
      OR: [
        { periodType: 'week', periodKey: prevWeekKey },
        { periodType: 'month', periodKey: monthKey },
      ],
    },
  })

  const prevWeekSummary = summaries.find(s => s.periodType === 'week' && s.periodKey === prevWeekKey)
  const monthSummary = summaries.find(s => s.periodType === 'month' && s.periodKey === monthKey)

  // Общая статистика
  const totalStats = await prisma.completedWork.groupBy({
    by: ['type'],
    where: { userId },
    _count: true,
  })
  const totalTasks = totalStats.reduce((sum, s) => sum + s._count, 0)
  const totalGoals = totalStats.find(s => s.type === 'goal')?._count || 0

  if (currentWeekItems.length === 0 && !prevWeekSummary && !monthSummary && totalTasks === 0) {
    return ''
  }

  const parts: string[] = ['--- ФАКТИЧЕСКИ ВЫПОЛНЕННАЯ РАБОТА ---']

  // Текущая неделя
  if (currentWeekItems.length > 0) {
    const strategic = currentWeekItems.filter(i => i.category === 'стратегические')
    const goals = currentWeekItems.filter(i => i.type === 'goal')
    const operational = currentWeekItems.filter(i => i.category === 'операционные')
    const other = currentWeekItems.filter(i => !['стратегические', 'операционные'].includes(i.category || '') && i.type !== 'goal')

    parts.push(`Текущая неделя (${weekKey}): ${currentWeekItems.length} задач выполнено`)
    if (strategic.length > 0) {
      strategic.slice(0, 5).forEach(t => parts.push(`  [стратег] ${t.text}`))
      if (strategic.length > 5) parts.push(`  ... и ещё ${strategic.length - 5} стратегических`)
    }
    if (goals.length > 0) {
      goals.forEach(g => parts.push(`  [цель] ${g.text}`))
    }
    if (operational.length > 0) {
      parts.push(`  ${operational.length} операционных задач`)
    }
    if (other.length > 0) {
      parts.push(`  ${other.length} других (привычки, созвоны)`)
    }
  }

  // Прошлая неделя
  if (prevWeekSummary) {
    parts.push(`Прошлая неделя (${prevWeekKey}): ${prevWeekSummary.summaryText}`)
  }

  // Текущий месяц
  if (monthSummary) {
    parts.push(`Текущий месяц (${monthKey}): ${monthSummary.summaryText}`)
  }

  // Общий итог
  if (totalTasks > 0) {
    parts.push(`Всего с момента регистрации: ${totalTasks} задач, ${totalGoals} целей`)
  }

  return parts.join('\n')
}
