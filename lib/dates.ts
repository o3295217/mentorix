import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns'

export type PeriodType = 'week' | 'month' | 'quarter' | 'half_year' | 'year'

export function getPeriodDates(date: Date, periodType: PeriodType): { start: Date; end: Date } {
  switch (periodType) {
    case 'week':
      return {
        start: startOfWeek(date, { weekStartsOn: 1 }), // Monday
        end: endOfWeek(date, { weekStartsOn: 1 }), // Sunday
      }
    case 'month':
      return {
        start: startOfMonth(date),
        end: endOfMonth(date),
      }
    case 'quarter':
      return {
        start: startOfQuarter(date),
        end: endOfQuarter(date),
      }
    case 'half_year': {
      const year = date.getFullYear()
      const month = date.getMonth()
      if (month < 6) {
        // H1
        return {
          start: new Date(year, 0, 1),
          end: new Date(year, 5, 30),
        }
      } else {
        // H2
        return {
          start: new Date(year, 6, 1),
          end: new Date(year, 11, 31),
        }
      }
    }
    case 'year':
      return {
        start: startOfYear(date),
        end: endOfYear(date),
      }
  }
}

export function getPeriodName(date: Date, periodType: PeriodType): string {
  const year = date.getFullYear()
  const month = date.getMonth()
  const quarter = Math.floor(month / 3) + 1

  switch (periodType) {
    case 'week':
      return `Неделя ${date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`
    case 'month':
      return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    case 'quarter':
      return `Q${quarter} ${year}`
    case 'half_year':
      return month < 6 ? `H1 ${year}` : `H2 ${year}`
    case 'year':
      return `${year}`
  }
}

export const getYearDistance = (year: number, currentYear: number = new Date().getFullYear()) => year - currentYear

export const getDetailLevel = (year: number, currentYear: number = new Date().getFullYear()): 'month' | 'quarter' | 'half' | 'year' => {
  const distance = getYearDistance(year, currentYear)
  if (distance === 0) return 'month'
  if (distance === 1) return 'quarter'
  if (distance <= 3) return 'half'
  return 'year'
}

// === Date-only helpers (P0: avoid UTC shift for 'YYYY-MM-DD') ===

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

// Parses a date param coming from UI/query/body.
// If value is 'YYYY-MM-DD', returns a local-midnight Date.
// Otherwise falls back to new Date(value) for ISO strings with time.
export function parseDateParam(value: string): Date {
  if (DATE_ONLY_RE.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(value)
}

// Local date key, safe for date-only semantics.
export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Форматирование горизонта в месяцах в человекочитаемую строку
export function formatHorizon(totalMonths: number, short = false): string {
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12

  const pluralYears = (n: number) => {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return 'год'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'года'
    return 'лет'
  }

  const pluralMonths = (n: number) => {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return 'месяц'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'месяца'
    return 'месяцев'
  }

  if (short) {
    if (y === 0) return `${m} мес`
    if (m === 0) return `${y} ${y === 1 ? 'г.' : 'л.'}`
    return `${y} г. ${m} мес`
  }

  if (y === 0) return `${m} ${pluralMonths(m)}`
  if (m === 0) return `${y} ${pluralYears(y)}`
  return `${y} ${pluralYears(y)} и ${m} мес`
}
