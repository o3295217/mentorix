// Логика миграции недельных periodKey со старого правила на ISO 8601.
//
// СТАРОЕ правило (заморожено здесь, в коде приложения не применяется):
// неделя N месяца начинается с «первый понедельник месяца + (N-1)*7».
//
// НОВОЕ правило — ISO 8601 (lib/goals-utils.ts): неделя принадлежит месяцу
// своего четверга, номер — порядковый номер этого четверга в месяце.
//
// Модуль нужен только scripts/migrate-week-keys-iso.ts и его тестам.

import { getWeekOfDate } from '@/lib/goals-utils'

export const WEEK_KEY_RE = /^(\d{4})-(\d{2})-W(\d+)$/

/** Понедельник недели N месяца по СТАРОМУ правилу (правилу понедельника). */
export function oldRuleWeekStart(year: number, month0: number, weekNum: number): Date {
  const d = new Date(year, month0, 1)
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1)
  d.setDate(d.getDate() + (weekNum - 1) * 7)
  return d
}

/**
 * Пересчёт ключа: старый ключ → понедельник по старому правилу →
 * ключ по ISO через getWeekOfDate. Ключ может совпасть с исходным
 * (месяцы, начинающиеся пт–пн). Для ключей не недельного формата — null.
 */
export function remapWeekKey(oldKey: string): string | null {
  const m = WEEK_KEY_RE.exec(oldKey)
  if (!m) return null
  const monday = oldRuleWeekStart(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10))
  return getWeekOfDate(monday).key
}
