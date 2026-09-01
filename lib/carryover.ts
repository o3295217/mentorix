// Логика «ревизии месяца»: незакрытые цели прошлого месяца, о которых
// напоминаем при входе. Чистые функции — работа с БД в API-роуте
// app/api/goals/carryover.

import { areTasksSimilar } from '@/lib/task-match'
import { fuzzyMatchGoal } from '@/lib/goals-utils'

export const MONTH_NAMES_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

export const monthKeyOf = (year: number, month0: number): string =>
  `${year}-${String(month0 + 1).padStart(2, '0')}`

// Предыдущий месяц относительно даты
export function prevMonthOf(date: Date): { year: number; month: number; key: string } {
  const year = date.getMonth() === 0 ? date.getFullYear() - 1 : date.getFullYear()
  const month = (date.getMonth() + 11) % 12
  return { year, month, key: monthKeyOf(year, month) }
}

// «2026-08» → «августа 2026» (родительный падеж — для «Цели августа 2026»)
export function formatMonthGenitive(monthKey: string): string {
  const m = monthKey.match(/^(\d{4})-(\d{2})$/)
  if (!m) return monthKey
  return `${MONTH_NAMES_GENITIVE[parseInt(m[2], 10) - 1] || monthKey} ${m[1]}`
}

// «2026-08» → «из августа 2026» (бейдж на перенесённой задаче)
export const formatCarriedFrom = (monthKey: string): string => `из ${formatMonthGenitive(monthKey)}`

export interface CarryoverSource {
  /** Ключ периода-источника: месяц «2026-08» или неделя «2026-08-W3» */
  key: string
  type: 'month' | 'week'
  texts: string[]
}

export interface TrackedGoalLite {
  periodKey: string
  text: string
  completed: boolean
}

export interface CarryoverItem {
  text: string
  fromKey: string
  fromType: 'month' | 'week'
}

/**
 * Незакрытые цели прошлого месяца, о которых стоит напомнить.
 * Цель выпадает из списка, если она выполнена (tracked-запись с completed),
 * уже перенесена самим пользователем в текущий месяц, уже отправлена
 * в бэклог задач, либо дублирует другую цель списка (декомпозиция
 * месяц → недели с одинаковой формулировкой показывается один раз —
 * источники с типом month подавайте первыми).
 */
export function collectCarryoverItems(params: {
  sources: CarryoverSource[]
  tracked: TrackedGoalLite[]
  currentMonthTexts: string[]
  openTaskTexts: string[]
}): CarryoverItem[] {
  const { sources, tracked, currentMonthTexts, openTaskTexts } = params
  const items: CarryoverItem[] = []

  for (const source of sources) {
    for (const text of source.texts) {
      if (!text.trim()) continue
      const isCompleted = tracked.some(g => g.periodKey === source.key && g.completed && fuzzyMatchGoal(g.text, text))
      if (isCompleted) continue
      if (currentMonthTexts.some(t => areTasksSimilar(t, text))) continue
      if (openTaskTexts.some(t => areTasksSimilar(t, text))) continue
      if (items.some(i => areTasksSimilar(i.text, text))) continue
      items.push({ text, fromKey: source.key, fromType: source.type })
    }
  }
  return items
}
