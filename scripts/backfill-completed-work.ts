/**
 * Скрипт ретро-заполнения таблицы completed_work из существующих DailyEntry и Goal.
 * Запуск: npx tsx scripts/backfill-completed-work.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function splitLines(text: string | null | undefined): string[] {
  return (text || '').split('\n').map(t => t.trim()).filter(Boolean)
}

function safeParseJsonArray<T>(json: string | null | undefined): T[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function getTaskCategory(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('подъём') || lower.includes('подъем') ||
      lower.includes('зарядка') || lower.includes('душ') ||
      lower.includes('начало работы') || lower.match(/^\d{1,2}:\d{2}/)) return 'привычки'
  if (lower.includes('оперативка') || lower.includes('созвон') ||
      lower.includes('встреча') || lower.includes('звонок')) return 'созвоны'
  if (lower.includes('стратег') || lower.includes('бюджет') ||
      lower.includes('планирование') || lower.includes('анализ') ||
      lower.includes('разработка') || lower.includes('проект')) return 'стратегические'
  return 'операционные'
}

async function main() {
  console.log('🔄 Ретро-заполнение completed_work...')

  // Очищаем таблицу (идемпотентный запуск)
  const deleted = await prisma.completedWork.deleteMany()
  console.log(`  Удалено старых записей: ${deleted.count}`)

  // 1. Заполняем из DailyEntry
  const entries = await prisma.dailyEntry.findMany({
    select: {
      id: true,
      userId: true,
      date: true,
      planText: true,
      selectedTasksJson: true,
      extraTasksJson: true,
    },
  })

  let taskCount = 0
  let extraCount = 0
  const batch: Array<{
    userId: string; date: Date; type: string; text: string;
    category: string; sourceType: string; sourceId: number;
  }> = []

  for (const entry of entries) {
    const planTasks = splitLines(entry.planText)
    const selectedIds = safeParseJsonArray<string | number>(entry.selectedTasksJson)
      .map(id => Number(id))
      .filter(id => Number.isInteger(id) && id > 0 && id <= planTasks.length)

    for (const id of selectedIds) {
      const text = planTasks[id - 1]
      if (text) {
        batch.push({
          userId: entry.userId,
          date: entry.date,
          type: 'task',
          text,
          category: getTaskCategory(text),
          sourceType: 'dailyEntry',
          sourceId: entry.id,
        })
        taskCount++
      }
    }

    const extraTasks = safeParseJsonArray<string>(entry.extraTasksJson).filter(Boolean)
    for (const text of extraTasks) {
      batch.push({
        userId: entry.userId,
        date: entry.date,
        type: 'extra',
        text,
        category: getTaskCategory(text),
        sourceType: 'dailyEntry',
        sourceId: entry.id,
      })
      extraCount++
    }
  }

  // 2. Заполняем из Goal (выполненные)
  const goals = await prisma.goal.findMany({
    where: { completed: true },
    select: {
      id: true,
      userId: true,
      text: true,
      periodKey: true,
      completedAt: true,
      createdAt: true,
    },
  })

  let goalCount = 0
  for (const goal of goals) {
    batch.push({
      userId: goal.userId,
      date: goal.completedAt || goal.createdAt,
      type: 'goal',
      text: goal.text,
      category: 'стратегические',
      sourceType: 'goal',
      sourceId: goal.id,
    })
    goalCount++
  }

  // Записываем батчем
  if (batch.length > 0) {
    await prisma.completedWork.createMany({ data: batch })
  }

  console.log(`✅ Записано: ${taskCount} задач, ${extraCount} экстра, ${goalCount} целей`)
  console.log(`   Итого: ${batch.length} записей completed_work`)

  // 3. Пересчитываем WorkSummary
  console.log('\n🔄 Пересчёт work_summaries...')
  await prisma.workSummary.deleteMany()

  // Группируем по userId
  const userIds = [...new Set(batch.map(b => b.userId))]

  for (const userId of userIds) {
    const items = await prisma.completedWork.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    })

    // Группируем по неделям и месяцам
    const weeks = new Map<string, typeof items>()
    const months = new Map<string, typeof items>()

    for (const item of items) {
      const d = new Date(item.date)
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      const y = weekStart.getFullYear()
      const weekNum = Math.ceil(((weekStart.getTime() - new Date(y, 0, 1).getTime()) / 86400000 + new Date(y, 0, 1).getDay() + 1) / 7)
      const weekKey = `${y}-W${String(weekNum).padStart(2, '0')}`
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

      if (!weeks.has(weekKey)) weeks.set(weekKey, [])
      weeks.get(weekKey)!.push(item)

      if (!months.has(monthKey)) months.set(monthKey, [])
      months.get(monthKey)!.push(item)
    }

    // Создаём сводки по неделям
    for (const [periodKey, periodItems] of weeks) {
      const summary = buildSummary('week', periodKey, periodItems)
      await prisma.workSummary.create({
        data: { userId, periodType: 'week', periodKey, ...summary },
      })
    }

    // Создаём сводки по месяцам
    for (const [periodKey, periodItems] of months) {
      const summary = buildSummary('month', periodKey, periodItems)
      await prisma.workSummary.create({
        data: { userId, periodType: 'month', periodKey, ...summary },
      })
    }

    console.log(`  Пользователь ${userId}: ${weeks.size} недель, ${months.size} месяцев`)
  }

  console.log('\n✅ Ретро-заполнение завершено!')
}

function buildSummary(periodType: string, periodKey: string, items: Array<{ type: string; text: string; category: string | null }>) {
  const tasksCompleted = items.filter(i => i.type === 'task' || i.type === 'extra').length
  const goalsCompleted = items.filter(i => i.type === 'goal').length
  const catCounts: Record<string, number> = {}
  for (const item of items) {
    const cat = item.category || 'другое'
    catCounts[cat] = (catCounts[cat] || 0) + 1
  }
  const achievements = items
    .filter(i => i.type === 'goal' || i.category === 'стратегические')
    .map(i => i.text).slice(0, 10)

  const parts: string[] = []
  parts.push(`${periodType === 'week' ? 'Неделя' : 'Месяц'} ${periodKey}: ${items.length} задач выполнено`)
  if (goalsCompleted > 0) parts.push(`${goalsCompleted} целей достигнуто`)
  if (achievements.length > 0) parts.push(`Ключевое: ${achievements.slice(0, 5).join('; ')}`)
  const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
  if (topCats.length > 0) parts.push(`Фокус: ${topCats.map(([cat, cnt]) => `${cat} (${cnt})`).join(', ')}`)

  return {
    summaryText: parts.join('. '),
    keyAchievements: JSON.stringify(achievements),
    tasksCompleted,
    goalsCompleted,
    topCategoriesJson: JSON.stringify(catCounts),
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
