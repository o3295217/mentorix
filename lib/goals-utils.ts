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
    case 'week':
      // Понедельник недели по ISO-правилу четверга — может быть в прошлом месяце
      return { periodType: 'week', date: parseWeekKey(key).weekStart, label: `Неделя ${p.index}` }
    default:
      return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// НЕДЕЛИ — ISO 8601
//
// Неделя всегда пн–вс. Неделя принадлежит месяцу, в который попадает её ЧЕТВЕРГ.
// Следствия, на которые обязан рассчитывать вызывающий код:
//   • даты недели МОГУТ лежать вне месяца из ключа: 2026-09-W1 = 31.08–06.09
//     (четверг 03.09 → сентябрь), 2026-10-W1 = 28.09–04.10 (четверг 01.10);
//   • в месяце ровно столько недель, сколько в нём четвергов — 4 или 5;
//   • у каждой недели ровно один месяц-владелец, поэтому недели соседних
//     месяцев стыкуются без дырок и без дублей.
//
// Это единственный источник истины по неделям: UI-сетка, декомпозиция целей,
// разбор и сборка ключей идут через функции ниже, своих вычислений быть не должно.
// ─────────────────────────────────────────────────────────────────────────────

export interface MonthWeek {
  /** Порядковый номер недели внутри месяца-владельца, с 1 */
  num: number
  /** Ключ периода, например «2026-09-W1» */
  key: string
  /** Год месяца-владельца (месяца четверга) */
  year: number
  /** Месяц-владелец (месяц четверга), 0-11 */
  month: number
  /** Понедельник — может быть в предыдущем месяце */
  start: Date
  /** Воскресенье — может быть в следующем месяце */
  end: Date
}

const THURSDAY = 4

const weekKeyOf = (year: number, month: number, num: number): string =>
  `${year}-${String(month + 1).padStart(2, '0')}-W${num}`

// Первый четверг месяца — якорь нумерации недель месяца
function getFirstThursday(year: number, month: number): Date {
  const d = new Date(year, month, 1)
  while (d.getDay() !== THURSDAY) d.setDate(d.getDate() + 1)
  return d
}

// Собирает неделю по её четвергу
function weekFromThursday(thursday: Date, year: number, month: number, num: number): MonthWeek {
  const start = new Date(thursday)
  start.setDate(start.getDate() - 3)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return { num, key: weekKeyOf(year, month, num), year, month, start, end }
}

/**
 * Все недели месяца — те, чей четверг лежит в этом месяце.
 * Август 2026 → 4 недели (03–09, 10–16, 17–23, 24–30).
 * Сентябрь 2026 → 5 недель, первая 31.08–06.09.
 */
export function getMonthWeeks(year: number, month: number): MonthWeek[] {
  const weeks: MonthWeek[] = []
  const thursday = getFirstThursday(year, month)

  let num = 1
  while (thursday.getMonth() === month && thursday.getFullYear() === year) {
    weeks.push(weekFromThursday(thursday, year, month, num))
    thursday.setDate(thursday.getDate() + 7)
    num++
  }
  return weeks
}

/**
 * Диапазон недели «31.08–06.09».
 * Недели по ISO часто пересекают границу месяца, поэтому день без месяца («31-6») читается неверно.
 */
export const formatWeekRange = (week: { start: Date; end: Date }): string => {
  const dm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
  return `${dm(week.start)}–${dm(week.end)}`
}

// Ключи всех недель месяца: ["2026-09-W1", …, "2026-09-W5"]
export function getMonthWeekKeys(year: number, month: number): string[] {
  return getMonthWeeks(year, month).map((w) => w.key)
}

// Понедельник недели, которой принадлежит дата (время обнуляется)
export function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

/**
 * Неделя, которой принадлежит дата, вместе с месяцем-владельцем (месяцем четверга).
 * 31.08.2026 и 01.09.2026 → 2026-09-W1; 28.09.2026 → 2026-10-W1.
 */
export function getWeekOfDate(date: Date): MonthWeek {
  const start = getWeekStart(date)
  const thursday = new Date(start)
  thursday.setDate(thursday.getDate() + 3)

  const year = thursday.getFullYear()
  const month = thursday.getMonth()
  const firstThursday = getFirstThursday(year, month)
  // Оба четверга в одном месяце — разница дат делится на 7 без остатка
  const num = (thursday.getDate() - firstThursday.getDate()) / 7 + 1

  return weekFromThursday(thursday, year, month, num)
}

/**
 * Разбор ключа недели («2026-09-W1» → понедельник 31.08.2026).
 * weekStart НЕ обязан лежать внутри месяца из ключа.
 */
export const parseWeekKey = (key: string): { weekStart: Date; weekNum: number; year: number; month: number } => {
  const parts = key.split('-') // 2026-09-W1
  const year = parseInt(parts[0])
  const month = parseInt(parts[1]) - 1
  const weekNum = parseInt(parts[2].replace('W', ''))

  const thursday = getFirstThursday(year, month)
  thursday.setDate(thursday.getDate() + (weekNum - 1) * 7)
  const weekStart = new Date(thursday)
  weekStart.setDate(weekStart.getDate() - 3)

  return { weekStart, weekNum, year, month }
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
    case 'week':
      // Месяц-владелец определяется четвергом недели, а не месяцем самой даты
      return getWeekOfDate(date).key
    default:
      return ''
  }
}


