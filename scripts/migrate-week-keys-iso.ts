/**
 * Миграция данных: пересчёт недельных periodKey со старого правила
 * («неделя N месяца = первый понедельник месяца + (N-1)*7») на ISO 8601
 * («неделя принадлежит месяцу своего ЧЕТВЕРГА, номер = порядковый номер
 * этого четверга в месяце»). Функция пересчёта — lib/week-key-migration.ts.
 *
 * Затрагивает: goals.periodKey (periodType='week'),
 * work_summaries.periodKey (periodType='week'),
 * completed_work.goalLink (значения формата YYYY-MM-WN).
 * PeriodGoal и PeriodEvaluation хранятся по дате periodStart и в пересчёте
 * не нуждаются.
 *
 * Идемпотентность: по строке ключа нельзя отличить старое правило от нового
 * (повторный пересчёт «2026-09-W2» дал бы «2026-09-W3»), поэтому факт
 * применения фиксируется маркером в таблице data_migrations — второй запуск
 * с --apply ничего не меняет.
 *
 * По умолчанию — dry-run (только печать плана). Запись: флаг --apply.
 * Запуск: ENCRYPTION_KEY=... npx tsx scripts/migrate-week-keys-iso.ts [--apply]
 */

import { prisma } from '../lib/prisma'
import { remapWeekKey, WEEK_KEY_RE } from '../lib/week-key-migration'

const MIGRATION_NAME = 'week-keys-iso'

interface Update { id: number; from: string; to: string }

// Изменившийся ключ всегда строго больше старого (тот же месяц и номер+1 либо
// W1 следующего месяца), поэтому обновление по убыванию from не создаёт
// временных дублей под @@unique(userId, periodType, periodKey) в work_summaries.
const toUpdates = (rows: Array<{ id: number; key: string | null }>): Update[] =>
  rows
    .map(r => ({ id: r.id, from: r.key ?? '', to: remapWeekKey(r.key ?? '') }))
    .filter((u): u is Update => u.to !== null && u.to !== u.from)
    .sort((a, b) => b.from.localeCompare(a.from))

async function isApplied(): Promise<boolean> {
  const table = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass('data_migrations') IS NOT NULL AS exists`
  if (!table[0]?.exists) return false
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT "name" FROM "data_migrations" WHERE "name" = ${MIGRATION_NAME}`
  return rows.length > 0
}

async function main() {
  const apply = process.argv.includes('--apply')
  console.log(apply ? '=== РЕЖИМ ЗАПИСИ (--apply) ===' : '=== DRY-RUN (без записи; для применения добавьте --apply) ===')

  if (await isApplied()) {
    console.log(`Миграция «${MIGRATION_NAME}» уже применена — изменений нет.`)
    return
  }

  const goals = await prisma.goal.findMany({
    where: { periodType: 'week' },
    select: { id: true, periodKey: true },
  })
  const goalUpdates = toUpdates(goals.map(g => ({ id: g.id, key: g.periodKey })))

  const summaries = await prisma.workSummary.findMany({
    where: { periodType: 'week' },
    select: { id: true, periodKey: true },
  })
  const summaryUpdates = toUpdates(summaries.map(s => ({ id: s.id, key: s.periodKey })))

  const works = await prisma.completedWork.findMany({
    where: { goalLink: { not: null } },
    select: { id: true, goalLink: true },
  })
  const workUpdates = toUpdates(works.map(w => ({ id: w.id, key: w.goalLink })))

  const report = (label: string, updates: Update[], total: number) => {
    console.log(`\n${label}: недельных записей ${total}, к пересчёту ${updates.length}`)
    for (const u of updates) console.log(`  #${u.id}: ${u.from} -> ${u.to}`)
  }
  report('goals.periodKey', goalUpdates, goals.length)
  report('work_summaries.periodKey', summaryUpdates, summaries.length)
  report('completed_work.goalLink', workUpdates, works.filter(w => WEEK_KEY_RE.test(w.goalLink ?? '')).length)

  if (!apply) return

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "data_migrations" (
      "name" TEXT PRIMARY KEY,
      "applied_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
  await prisma.$transaction([
    ...goalUpdates.map(u => prisma.goal.update({ where: { id: u.id }, data: { periodKey: u.to } })),
    ...summaryUpdates.map(u => prisma.workSummary.update({ where: { id: u.id }, data: { periodKey: u.to } })),
    ...workUpdates.map(u => prisma.completedWork.update({ where: { id: u.id }, data: { goalLink: u.to } })),
    prisma.$executeRaw`INSERT INTO "data_migrations" ("name") VALUES (${MIGRATION_NAME}) ON CONFLICT ("name") DO NOTHING`,
  ])
  console.log(`\nГотово: goals ${goalUpdates.length}, work_summaries ${summaryUpdates.length}, completed_work ${workUpdates.length}.`)
}

main()
  .catch(e => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
