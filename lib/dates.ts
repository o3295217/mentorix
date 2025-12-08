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
