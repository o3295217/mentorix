// Цели периодов поверх единой таблицы goals (запись = цель с id).
// PeriodGoal.goalsJson — легаси-хранилище: его читает только
// scripts/migrate-period-goals-to-tracked.ts; весь рабочий код ходит сюда.

import { prisma } from '@/lib/prisma'
import { getPeriodKey } from '@/lib/goals-utils'
import { diffPeriodGoalTexts } from '@/lib/period-goals-diff'

export type GoalPeriodType = 'week' | 'month' | 'quarter' | 'half_year'

// PeriodGoal.periodStart хранится как полночь в поясе создателя записи;
// +12ч прощает разницу поясов до ±12ч при определении календарного периода
export const normalizePeriodStart = (d: Date): Date => new Date(d.getTime() + 12 * 3600 * 1000)

export const periodKeyFromStart = (periodType: GoalPeriodType, periodStart: Date): string =>
  getPeriodKey(periodType, normalizePeriodStart(periodStart))

export function listPeriodGoalRows(userId: string, periodKey: string) {
  return prisma.goal.findMany({
    where: { userId, periodKey },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })
}

export async function getPeriodGoalTexts(userId: string, periodType: GoalPeriodType, date: Date): Promise<string[]> {
  const rows = await listPeriodGoalRows(userId, getPeriodKey(periodType, date))
  return rows.map(r => r.text)
}

/**
 * Приводит записи Goal периода к желаемому списку текстов (см. дифф).
 * Возвращает актуальные записи в итоговом порядке.
 */
export async function reconcilePeriodGoals(params: {
  userId: string
  periodType: GoalPeriodType
  periodKey: string
  texts: string[]
}) {
  const { userId, periodType, periodKey, texts } = params
  const existing = await prisma.goal.findMany({
    where: { userId, periodKey },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, text: true },
  })
  const diff = diffPeriodGoalTexts(existing, texts)

  await prisma.$transaction([
    ...diff.create.map(c =>
      prisma.goal.create({ data: { userId, text: c.text, periodType, periodKey, sortOrder: c.sortOrder } })
    ),
    ...diff.update.map(u =>
      prisma.goal.update({ where: { id: u.id }, data: { text: u.text, sortOrder: u.sortOrder } })
    ),
    ...(diff.removeIds.length > 0
      ? [prisma.goal.deleteMany({ where: { userId, id: { in: diff.removeIds } } })]
      : []),
  ])

  return listPeriodGoalRows(userId, periodKey)
}
