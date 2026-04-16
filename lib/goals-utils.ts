// Утилиты для работы с целями

import { parseDateParam, toDateKey } from '@/lib/dates'

export const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

// Backward compat alias
export const monthNames = MONTH_NAMES

// Нечёткое сравнение текста целей (по первым 30 символам)
export const fuzzyMatchGoal = (a: string, b: string): boolean =>
  a === b || a.startsWith(b.slice(0, 30)) || b.startsWith(a.slice(0, 30))

// Тип периода
export type PeriodType = 'year' | 'half_year' | 'quarter' | 'month' | 'week'

// Результат разбора period key
export interface ParsedPeriodKey {
  type: PeriodType
  year: number
  /** Half: 1|2, Quarter: 1-4, Month: 0-11 (js-style), Week: 1-5 */
  index: number
  /** Для week — номер месяца (0-11) */
  month?: number
}

// Разбирает period key строку в структуру
export function parsePeriodKey(key: string): ParsedPeriodKey | null {
  let m: RegExpMatchArray | null

  // Year: "2026"
  m = key.match(/^(\d{4})$/)
  if (m) return { type: 'year', year: parseInt(m[1], 10), index: 0 }

  // Half-year: "2026-H1"
  m = key.match(/^(\d{4})-H([12])$/)
  if (m) return { type: 'half_year', year: parseInt(m[1], 10), index: parseInt(m[2], 10) }

  // Quarter: "2026-Q3"
  m = key.match(/^(\d{4})-Q([1-4])$/)
  if (m) return { type: 'quarter', year: parseInt(m[1], 10), index: parseInt(m[2], 10) }

  // Week: "2026-04-W2" (must check before month)
  m = key.match(/^(\d{4})-(\d{2})-W(\d+)$/)
  if (m) return { type: 'week', year: parseInt(m[1], 10), index: parseInt(m[3], 10), month: parseInt(m[2], 10) - 1 }

  // Month: "2026-04"
  m = key.match(/^(\d{4})-(\d{2})$/)
  if (m) return { type: 'month', year: parseInt(m[1], 10), index: parseInt(m[2], 10) - 1 }

  return null
}

// Определяет periodType из period key строки
export function periodTypeFromKey(key: string): PeriodType {
  return parsePeriodKey(key)?.type ?? 'week'
}

// Форматирует period key в человекочитаемую строку
export function formatPeriodLabel(periodKey: string): string {
  const p = parsePeriodKey(periodKey)
  if (!p) return periodKey
  switch (p.type) {
    case 'year': return `${p.year} год`
    case 'half_year': return `H${p.index} ${p.year}`
    case 'quarter': return `Q${p.index} ${p.year}`
    case 'month': return `${MONTH_NAMES[p.index] || periodKey} ${p.year}`
    case 'week': return `Неделя ${p.index}, ${MONTH_NAMES[p.month!] || ''} ${p.year}`
  }
}

// Возвращает periodType, date и label для любого period key
export function resolvePeriodMeta(key: string): { periodType: PeriodType; date: Date; label: string } | null {
  const p = parsePeriodKey(key)
  if (!p) return null
  switch (p.type) {
    case 'half_year':
      return { periodType: 'half_year', date: new Date(p.year, (p.index - 1) * 6, 1), label: `H${p.index} ${p.year}` }
    case 'quarter':
      return { periodType: 'quarter', date: new Date(p.year, (p.index - 1) * 3, 1), label: `Q${p.index}` }
    case 'month':
      return { periodType: 'month', date: new Date(p.year, p.index, 1), label: MONTH_NAMES[p.index] }
    case 'week': {
      const firstDay = new Date(p.year, p.month!, 1)
      const d = new Date(firstDay)
      while (d.getDay() !== 1) d.setDate(d.getDate() + 1)
      d.setDate(d.getDate() + (p.index - 1) * 7)
      return { periodType: 'week', date: d, label: `Неделя ${p.index}` }
    }
    default:
      return null
  }
}

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


