// Логика «ревизии месяца»: незакрытые цели прошлого месяца, о которых
// напоминаем при входе. Источник — записи Goal (единая модель целей);
// чистые функции, работа с БД — в app/api/goals/carryover.

import { areTasksSimilar } from '@/lib/task-match'

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

export interface CarryoverGoalRow {
  id: number
  text: string
  periodKey: string
  completed: boolean
}

export interface CarryoverItem {
  goalId: number
  text: string
  fromKey: string
  fromType: 'month' | 'week'
}

/**
 * Незакрытые цели прошлого месяца, о которых стоит напомнить.
 * prevKeys — ключ месяца и ключи его недель. Цель выпадает из списка,
 * если она выполнена, похожий текст уже есть в текущем месяце (перенёс сам),
 * уже отправлена в бэклог задач, либо дублирует другую цель списка
 * (декомпозиция месяц → недели: месячная запись показывается один раз).
 */
export function collectCarryoverItems(params: {
  prevMonthKey: string
  prevKeys: string[]
  rows: CarryoverGoalRow[]
  currentMonthTexts: string[]
  openTaskTexts: string[]
}): CarryoverItem[] {
  const { prevMonthKey, prevKeys, rows, currentMonthTexts, openTaskTexts } = params
  const prevKeySet = new Set(prevKeys)
  const items: CarryoverItem[] = []

  const candidates = rows
    .filter(r => prevKeySet.has(r.periodKey) && !r.completed && r.text.trim())
    // Месячные цели первыми — дедуп предпочитает их недельным дублям
    .sort((a, b) => (a.periodKey === b.periodKey ? 0 : a.periodKey === prevMonthKey ? -1 : b.periodKey === prevMonthKey ? 1 : 0))

  for (const row of candidates) {
    if (currentMonthTexts.some(t => areTasksSimilar(t, row.text))) continue
    if (openTaskTexts.some(t => areTasksSimilar(t, row.text))) continue
    if (items.some(i => areTasksSimilar(i.text, row.text))) continue
    items.push({
      goalId: row.id,
      text: row.text,
      fromKey: row.periodKey,
      fromType: row.periodKey === prevMonthKey ? 'month' : 'week',
    })
  }
  return items
}
