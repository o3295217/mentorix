/**
 * Миграция данных: пересчёт недельных periodKey со старого правила
 * («неделя N месяца = первый понедельник месяца + (N-1)*7») на ISO 8601
 * («неделя принадлежит месяцу своего ЧЕТВЕРГА, номер = порядковый номер
 * этого четверга в месяце»).
 *
 * Затрагивает: goals.periodKey (periodType='week'),
 * work_summaries.periodKey (periodType='week'),
 * completed_work.goalLink (значения формата YYYY-MM-WN).
 * PeriodGoal хранится по дате periodStart и в пересчёте не нуждается.
 *
 * По умолчанию — dry-run (только печать плана). Запись: флаг --apply.
 * Запуск: ENCRYPTION_KEY=... npx tsx scripts/migrate-week-keys-iso.ts [--apply]
 */

import { prisma } from '../lib/prisma'

const WEEK_KEY_RE = /^(\d{4})-(\d{2})-W(\d+)$/

/** Понедельник недели N месяца по СТАРОМУ правилу (правило понедельника). */
function oldRuleWeekStart(year: number, month0: number, weekNum: number): Date {
  const d = new Date(year, month0, 1)
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1)
  d.setDate(d.getDate() + (weekNum - 1) * 7)
  return d
}

/** Ключ недели по НОВОМУ правилу (ISO: месяц и номер — по четвергу недели). */
function isoKeyForWeekStart(monday: Date): string {
  const thursday = new Date(monday)
  thursday.setDate(thursday.getDate() + 3)
  const weekNum = Math.floor((thursday.getDate() - 1) / 7) + 1
  return `${thursday.getFullYear()}-${String(thursday.getMonth() + 1).padStart(2, '0')}-W${weekNum}`
}

/** Старый ключ → новый ключ; null, если ключ не недельный или уже совпадает. */
export function remapWeekKey(oldKey: string): string | null {
  const m = WEEK_KEY_RE.exec(oldKey)
  if (!m) return null
  const monday = oldRuleWeekStart(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10))
  const newKey = isoKeyForWeekStart(monday)
  return newKey === oldKey ? null : newKey
}

async function main() {
  const apply = process.argv.includes('--apply')
  console.log(apply ? '=== РЕЖИМ ЗАПИСИ (--apply) ===' : '=== DRY-RUN (без записи; для применения добавьте --apply) ===')

  const goals = await prisma.goal.findMany({
    where: { periodType: 'week' },
    select: { id: true, periodKey: true },
  })
  const goalUpdates = goals
    .map(g => ({ id: g.id, from: g.periodKey, to: remapWeekKey(g.periodKey) }))
    .filter((u): u is { id: number; from: string; to: string } => u.to !== null)

  const summaries = await prisma.workSummary.findMany({
    where: { periodType: 'week' },
    select: { id: true, periodKey: true },
  })
  const summaryUpdates = summaries
    .map(s => ({ id: s.id, from: s.periodKey, to: remapWeekKey(s.periodKey) }))
    .filter((u): u is { id: number; from: string; to: string } => u.to !== null)

  const works = await prisma.completedWork.findMany({
    where: { goalLink: { not: null } },
    select: { id: true, goalLink: true },
  })
  const workUpdates = works
    .map(w => ({ id: w.id, from: w.goalLink as string, to: remapWeekKey(w.goalLink as string) }))
    .filter((u): u is { id: number; from: string; to: string } => u.to !== null)

  const report = (label: string, updates: Array<{ id: number; from: string; to: string }>, total: number) => {
    console.log(`\n${label}: недельных записей ${total}, к пересчёту ${updates.length}`)
    for (const u of updates) console.log(`  #${u.id}: ${u.from} -> ${u.to}`)
  }
  report('goals.periodKey', goalUpdates, goals.length)
  report('work_summaries.periodKey', summaryUpdates, summaries.length)
  report('completed_work.goalLink', workUpdates, works.filter(w => WEEK_KEY_RE.test(w.goalLink ?? '')).length)

  if (!apply) return

  await prisma.$transaction([
    ...goalUpdates.map(u => prisma.goal.update({ where: { id: u.id }, data: { periodKey: u.to } })),
    ...summaryUpdates.map(u => prisma.workSummary.update({ where: { id: u.id }, data: { periodKey: u.to } })),
    ...workUpdates.map(u => prisma.completedWork.update({ where: { id: u.id }, data: { goalLink: u.to } })),
  ])
  console.log(`\nГотово: goals ${goalUpdates.length}, work_summaries ${summaryUpdates.length}, completed_work ${workUpdates.length}.`)
}

main()
  .catch(e => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
