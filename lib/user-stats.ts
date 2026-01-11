import { prisma } from '@/lib/prisma'

// Тип для статистики по дням недели
interface DayStats {
  [key: string]: { total: number; completed: number }
}

// Тип для статистики по типам задач
interface TypeStats {
  [key: string]: { total: number; completed: number }
}

// Дни недели на русском
const DAYS_RU: { [key: number]: string } = {
  0: 'воскресенье',
  1: 'понедельник',
  2: 'вторник',
  3: 'среда',
  4: 'четверг',
  5: 'пятница',
  6: 'суббота',
}

// Определить тип задачи по тексту
function getTaskType(text: string): string {
  const lower = text.toLowerCase()
  
  // Привычки
  if (lower.includes('подъём') || lower.includes('подъем') || 
      lower.includes('зарядка') || lower.includes('душ') ||
      lower.includes('начало работы') || lower.match(/^\d{1,2}:\d{2}/)) {
    return 'привычки'
  }
  
  // Оперативки/созвоны
  if (lower.includes('оперативка') || lower.includes('созвон') ||
      lower.includes('встреча') || lower.includes('звонок')) {
    return 'созвоны'
  }
  
  // Стратегические (длинные задачи с ключевыми словами)
  if (lower.includes('стратег') || lower.includes('бюджет') ||
      lower.includes('планирование') || lower.includes('анализ') ||
      lower.includes('разработка') || lower.includes('проект')) {
    return 'стратегические'
  }
  
  return 'операционные'
}

// Извлечь ключевые слова из задачи
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4)
    .slice(0, 3)
}

// Пересчитать и обновить статистику пользователя
export async function recalculateUserStats(userId: string): Promise<void> {
  // Получить все оценённые дни этого пользователя
  const entries = await prisma.dailyEntry.findMany({
    where: {
      userId,
      evaluation: { isNot: null },
    },
    select: {
      date: true,
      planText: true,
      selectedTasksJson: true,
      evaluation: {
        select: { overallScore: true },
      },
    },
    orderBy: { date: 'asc' },
  })

  if (entries.length === 0) {
    return
  }

  let totalDays = 0
  let totalPlanned = 0
  let totalCompleted = 0
  let totalScore = 0
  let scoreCount = 0

  const dayStats: DayStats = {}
  const typeStats: TypeStats = {}
  const keywordStats: { [key: string]: { completed: number; failed: number } } = {}

  // Для определения оптимального количества задач
  const taskCountStats: { [count: number]: { total: number; completed: number } } = {}

  // Streak tracking
  let currentStreak = 0
  let bestStreak = 0
  let lastDate: Date | null = null

  for (const entry of entries) {
    const planLines = entry.planText
      ? entry.planText.split('\n').filter(l => l.trim())
      : []
    
    const selectedIds: number[] = entry.selectedTasksJson
      ? JSON.parse(entry.selectedTasksJson)
      : []

    const plannedCount = planLines.length
    const completedCount = Math.min(selectedIds.length, plannedCount)

    if (plannedCount === 0) continue

    totalDays++
    totalPlanned += plannedCount
    totalCompleted += completedCount

    // Оценка дня
    if (entry.evaluation?.overallScore) {
      totalScore += entry.evaluation.overallScore
      scoreCount++
    }

    // День недели
    const dayOfWeek = DAYS_RU[entry.date.getDay()]
    if (!dayStats[dayOfWeek]) {
      dayStats[dayOfWeek] = { total: 0, completed: 0 }
    }
    dayStats[dayOfWeek].total += plannedCount
    dayStats[dayOfWeek].completed += completedCount

    // Типы задач и ключевые слова
    planLines.forEach((task, idx) => {
      const taskType = getTaskType(task)
      if (!typeStats[taskType]) {
        typeStats[taskType] = { total: 0, completed: 0 }
      }
      typeStats[taskType].total++
      
      const isCompleted = selectedIds.includes(idx + 1)
      if (isCompleted) {
        typeStats[taskType].completed++
      }

      // Ключевые слова
      const keywords = extractKeywords(task)
      for (const kw of keywords) {
        if (!keywordStats[kw]) {
          keywordStats[kw] = { completed: 0, failed: 0 }
        }
        if (isCompleted) {
          keywordStats[kw].completed++
        } else {
          keywordStats[kw].failed++
        }
      }
    })

    // Оптимальное количество задач
    if (!taskCountStats[plannedCount]) {
      taskCountStats[plannedCount] = { total: 0, completed: 0 }
    }
    taskCountStats[plannedCount].total += plannedCount
    taskCountStats[plannedCount].completed += completedCount

    // Streak
    if (lastDate) {
      const diffDays = Math.floor(
        (entry.date.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (diffDays === 1) {
        currentStreak++
      } else {
        bestStreak = Math.max(bestStreak, currentStreak)
        currentStreak = 1
      }
    } else {
      currentStreak = 1
    }
    lastDate = entry.date
  }
  bestStreak = Math.max(bestStreak, currentStreak)

  // Рассчитать средние
  const avgCompletionPct = totalPlanned > 0 
    ? (totalCompleted / totalPlanned) * 100 
    : 0
  const avgDailyScore = scoreCount > 0 
    ? totalScore / scoreCount 
    : 0

  // Конвертировать статистику по дням в проценты
  const completionByDay: { [key: string]: number } = {}
  for (const [day, stats] of Object.entries(dayStats)) {
    completionByDay[day] = stats.total > 0 
      ? Math.round((stats.completed / stats.total) * 100) 
      : 0
  }

  // Конвертировать статистику по типам в проценты
  const completionByType: { [key: string]: number } = {}
  for (const [type, stats] of Object.entries(typeStats)) {
    completionByType[type] = stats.total > 0 
      ? Math.round((stats.completed / stats.total) * 100) 
      : 0
  }

  // Найти лучший/худший день
  let bestDay = ''
  let bestDayPct = 0
  let worstDay = ''
  let worstDayPct = 100

  for (const [day, pct] of Object.entries(completionByDay)) {
    if (pct > bestDayPct) {
      bestDayPct = pct
      bestDay = day
    }
    if (pct < worstDayPct) {
      worstDayPct = pct
      worstDay = day
    }
  }

  // Найти оптимальное количество задач
  let optimalTaskCount = 5
  let maxCompletionPct = 0
  for (const [countStr, stats] of Object.entries(taskCountStats)) {
    const count = parseInt(countStr)
    if (count >= 3 && count <= 10) { // Разумный диапазон
      const pct = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
      if (pct > maxCompletionPct) {
        maxCompletionPct = pct
        optimalTaskCount = count
      }
    }
  }

  // Частые выполняемые/невыполняемые ключевые слова
  const sortedKeywords = Object.entries(keywordStats)
    .filter(([_, s]) => s.completed + s.failed >= 3) // Минимум 3 упоминания
    .map(([kw, s]) => ({
      keyword: kw,
      total: s.completed + s.failed,
      completionRate: s.completed / (s.completed + s.failed),
    }))

  const frequentCompleted = sortedKeywords
    .filter(k => k.completionRate >= 0.7)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map(k => k.keyword)

  const frequentFailed = sortedKeywords
    .filter(k => k.completionRate <= 0.3)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map(k => k.keyword)

  // Тренд (последние 30 дней vs предыдущие)
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  const recentEntries = entries.filter(e => e.date >= thirtyDaysAgo)
  const previousEntries = entries.filter(e => e.date >= sixtyDaysAgo && e.date < thirtyDaysAgo)

  let trendDirection: string | null = null
  let trendPct = 0

  if (recentEntries.length >= 5 && previousEntries.length >= 5) {
    const recentPct = calculateCompletionPct(recentEntries)
    const previousPct = calculateCompletionPct(previousEntries)
    trendPct = recentPct - previousPct

    if (trendPct > 5) {
      trendDirection = 'improving'
    } else if (trendPct < -5) {
      trendDirection = 'declining'
    } else {
      trendDirection = 'stable'
    }
  }

  // Привычки: средний % выполнения
  const habitsAvgCompletion = completionByType['привычки'] || 0

  // Сохранить в БД (ищем по userId)
  const existingStats = await prisma.userStats.findFirst({ where: { userId } })
  
  if (existingStats) {
    await prisma.userStats.update({
      where: { id: existingStats.id },
      data: {
        totalDays,
        totalPlanned,
        totalCompleted,
        avgCompletionPct,
        avgDailyScore,
        completionByDayJson: JSON.stringify(completionByDay),
        completionByTypeJson: JSON.stringify(completionByType),
        frequentCompletedJson: JSON.stringify(frequentCompleted),
        frequentFailedJson: JSON.stringify(frequentFailed),
        habitsAvgCompletion,
        trendDirection,
        trendPct,
        bestDayOfWeek: bestDay || null,
        worstDayOfWeek: worstDay || null,
        optimalTaskCount,
        currentStreak,
        bestStreak,
      },
    })
  } else {
    await prisma.userStats.create({
      data: {
        userId,
        totalDays,
        totalPlanned,
        totalCompleted,
        avgCompletionPct,
        avgDailyScore,
        completionByDayJson: JSON.stringify(completionByDay),
        completionByTypeJson: JSON.stringify(completionByType),
        frequentCompletedJson: JSON.stringify(frequentCompleted),
        frequentFailedJson: JSON.stringify(frequentFailed),
        habitsAvgCompletion,
        trendDirection,
        trendPct,
        bestDayOfWeek: bestDay || null,
        worstDayOfWeek: worstDay || null,
        optimalTaskCount,
        currentStreak,
        bestStreak,
      },
    })
  }

  console.log('[UserStats] Recalculated stats for user', userId, ':', totalDays, 'days')
}

// Вспомогательная функция для расчёта % выполнения
function calculateCompletionPct(entries: { planText: string | null; selectedTasksJson: string | null }[]): number {
  let total = 0
  let completed = 0

  for (const entry of entries) {
    const planLines = entry.planText
      ? entry.planText.split('\n').filter(l => l.trim())
      : []
    const selectedIds: number[] = entry.selectedTasksJson
      ? JSON.parse(entry.selectedTasksJson)
      : []

    total += planLines.length
    completed += Math.min(selectedIds.length, planLines.length)
  }

  return total > 0 ? (completed / total) * 100 : 0
}

// Получить статистику для ИИ
export async function getUserStatsForAI(userId: string): Promise<string> {
  const stats = await prisma.userStats.findFirst({ where: { userId } })
  
  if (!stats || stats.totalDays === 0) {
    return 'Статистика пока не накоплена (нет оценённых дней).'
  }

  const lines: string[] = []
  
  lines.push(`📊 НАКОПИТЕЛЬНАЯ СТАТИСТИКА (${stats.totalDays} оценённых дней):`)
  lines.push(``)
  
  // Общие метрики
  lines.push(`📈 Общие показатели:`)
  lines.push(`• Средний % выполнения плана: ${Math.round(stats.avgCompletionPct)}%`)
  lines.push(`• Средняя оценка дня: ${stats.avgDailyScore.toFixed(1)}/10`)
  lines.push(`• Оптимальное количество задач: ${stats.optimalTaskCount}`)
  lines.push(`• Текущая серия планирования: ${stats.currentStreak} дней`)
  if (stats.bestStreak > stats.currentStreak) {
    lines.push(`• Лучшая серия: ${stats.bestStreak} дней`)
  }
  
  // Тренд
  if (stats.trendDirection) {
    const emoji = stats.trendDirection === 'improving' ? '📈' : 
                  stats.trendDirection === 'declining' ? '📉' : '➡️'
    const text = stats.trendDirection === 'improving' ? 'улучшение' : 
                 stats.trendDirection === 'declining' ? 'снижение' : 'стабильно'
    lines.push(`• Тренд за месяц: ${emoji} ${text} (${stats.trendPct > 0 ? '+' : ''}${Math.round(stats.trendPct)}%)`)
  }
  
  lines.push(``)
  
  // По дням недели
  const byDay = JSON.parse(stats.completionByDayJson || '{}')
  if (Object.keys(byDay).length > 0) {
    lines.push(`📅 Эффективность по дням недели:`)
    for (const [day, pct] of Object.entries(byDay)) {
      const bar = getProgressBar(pct as number)
      lines.push(`• ${day}: ${bar} ${pct}%`)
    }
    if (stats.bestDayOfWeek) {
      lines.push(`✅ Лучший день: ${stats.bestDayOfWeek}`)
    }
    if (stats.worstDayOfWeek && stats.worstDayOfWeek !== stats.bestDayOfWeek) {
      lines.push(`⚠️ Сложный день: ${stats.worstDayOfWeek}`)
    }
    lines.push(``)
  }
  
  // По типам задач
  const byType = JSON.parse(stats.completionByTypeJson || '{}')
  if (Object.keys(byType).length > 0) {
    lines.push(`🏷️ Эффективность по типам задач:`)
    for (const [type, pct] of Object.entries(byType)) {
      const bar = getProgressBar(pct as number)
      lines.push(`• ${type}: ${bar} ${pct}%`)
    }
    lines.push(``)
  }
  
  // Ключевые слова
  const completed = JSON.parse(stats.frequentCompletedJson || '[]')
  const failed = JSON.parse(stats.frequentFailedJson || '[]')
  
  if (completed.length > 0) {
    lines.push(`✅ Часто ВЫПОЛНЯЕМЫЕ задачи (ключевые слова): ${completed.slice(0, 5).join(', ')}`)
  }
  if (failed.length > 0) {
    lines.push(`❌ Часто НЕвыполняемые задачи: ${failed.slice(0, 5).join(', ')}`)
  }
  
  return lines.join('\n')
}

// Простой прогресс-бар
function getProgressBar(pct: number): string {
  const filled = Math.round(pct / 10)
  return '▓'.repeat(filled) + '░'.repeat(10 - filled)
}
