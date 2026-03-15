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

// Получение ключа периода (алгоритм синхронизирован с useGoals.loadPeriodGoalsWithKey)
export const getPeriodKey = (periodType: 'quarter' | 'month' | 'week' | 'half_year', date: Date): string => {
  const year = date.getFullYear()
  const month = date.getMonth()
  
  switch (periodType) {
    case 'quarter':
      return `${year}-Q${Math.floor(month / 3) + 1}`
    case 'half_year':
      return `${year}-H${month < 6 ? 1 : 2}`
    case 'month':
      return `${year}-${String(month + 1).padStart(2, '0')}`
    case 'week': {
      const firstDay = new Date(year, month, 1)
      const current = new Date(firstDay)
      while (current.getDay() !== 1 && current <= date) {
        current.setDate(current.getDate() + 1)
      }
      let weekNum = 1
      while (current <= date) {
        current.setDate(current.getDate() + 7)
        if (current <= date) weekNum++
      }
      return `${year}-${String(month + 1).padStart(2, '0')}-W${weekNum}`
    }
    default:
      return ''
  }
}


