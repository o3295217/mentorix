// Утилиты для работы с целями

import { parseDateParam, toDateKey } from '@/lib/dates'

export const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

// Helper to parse week key (e.g., "2025-12-W1")
export const parseWeekKey = (key: string): { weekStart: Date; weekNum: number; year: number; month: number } => {
  const parts = key.split('-') // 2025-12-W1
  const year = parseInt(parts[0])
  const month = parseInt(parts[1]) - 1
  const weekNum = parseInt(parts[2].replace('W', ''))
  
  const firstDay = new Date(year, month, 1)
  const current = new Date(firstDay)
  while (current.getDay() !== 1) current.setDate(current.getDate() + 1)
  for (let i = 1; i < weekNum; i++) current.setDate(current.getDate() + 7)
  return { weekStart: current, weekNum, year, month }
}

// Проверка на дубликат (нечёткое сравнение - игнорирует регистр и пробелы)
export const isDuplicate = (goals: string[], newGoal: string): boolean => {
  const normalize = (s: string) => s.toLowerCase().trim()
  return goals.some(g => normalize(g) === normalize(newGoal))
}

// Проверка просрочки цели
export const isOverdue = (deadline: string | null): boolean => {
  if (!deadline) return false
  return toDateKey(parseDateParam(deadline)) < toDateKey(new Date())
}

// Получение ключа периода
export const getPeriodKey = (periodType: 'quarter' | 'month' | 'week', date: Date): string => {
  const year = date.getFullYear()
  const month = date.getMonth()
  
  switch (periodType) {
    case 'quarter':
      return `${year}-Q${Math.floor(month / 3) + 1}`
    case 'month':
      return `${year}-${String(month + 1).padStart(2, '0')}`
    case 'week': {
      // Для недели нужна дополнительная логика
      const firstDay = new Date(year, month, 1)
      const weekStart = new Date(firstDay)
      while (weekStart.getDay() !== 1) weekStart.setDate(weekStart.getDate() + 1)
      
      let weekNum = 1
      while (weekStart <= date) {
        if (date >= weekStart && date < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)) {
          break
        }
        weekStart.setDate(weekStart.getDate() + 7)
        weekNum++
      }
      return `${year}-${String(month + 1).padStart(2, '0')}-W${weekNum}`
    }
    default:
      return ''
  }
}

// Определение уровня детализации в зависимости от года
export const getDetailLevel = (year: number, currentYear: number): 'year' | 'quarter' | 'month' => {
  const diff = year - currentYear
  if (diff <= 1) return 'month'
  if (diff <= 3) return 'quarter'
  return 'year'
}
