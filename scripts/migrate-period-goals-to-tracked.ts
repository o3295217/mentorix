/**
 * Миграция данных: тексты целей из PeriodGoal.goalsJson становятся записями
 * Goal (единый источник правды: одна цель = одна запись с id, выполненностью,
 * историей). Для каждого текста ищется существующая tracked-запись того же
 * периода (точное, затем нечёткое совпадение); найденной проставляется
 * sortOrder по позиции в списке, отсутствующая создаётся.
 *
 * PeriodGoal не удаляется (легаси-архив, рабочий код его больше не читает).
 * Идемпотентность: по совпадению текстов + маркер в data_migrations.
 *
 * По умолчанию — dry-run (только печать плана). Запись: флаг --apply.
 * Запуск: ENCRYPTION_KEY=... npx tsx scripts/migrate-period-goals-to-tracked.ts [--apply]
 */

import { prisma } from '../lib/prisma'
import { fuzzyMatchGoal } from '../lib/goals-utils'
import { periodKeyFromStart, GoalPeriodType } from '../lib/period-goals'

const MIGRATION_NAME = 'period-goals-to-tracked'
const PERIOD_TYPES: GoalPeriodType[] = ['week', 'month', 'quarter', 'half_year']

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

  const periodGoals = await prisma.periodGoal.findMany({
    where: { periodType: { in: PERIOD_TYPES } },
    orderBy: [{ periodStart: 'asc' }, { createdAt: 'asc' }],
  })

  let created = 0
  let reordered = 0

  for (const pg of periodGoals) {
    const texts = (Array.isArray(pg.goalsJson) ? pg.goalsJson : [])
      .map(g => (typeof g === 'string' ? g : String((g as { text?: string })?.text ?? '')))
      .map(t => t.trim())
      .filter(Boolean)
    if (texts.length === 0) continue

    const periodType = pg.periodType as GoalPeriodType
    const periodKey = periodKeyFromStart(periodType, pg.periodStart)

    const existing = await prisma.goal.findMany({
      where: { userId: pg.userId, periodKey },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    const unmatched = new Map(existing.map(g => [g.id, g]))

    for (const [index, text] of texts.entries()) {
      let matchId: number | null = null
      for (const [id, g] of unmatched) {
        if (g.text === text) { matchId = id; break }
      }
      if (matchId === null) {
        for (const [id, g] of unmatched) {
          if (fuzzyMatchGoal(g.text, text)) { matchId = id; break }
        }
      }

      if (matchId !== null) {
        const match = unmatched.get(matchId)!
        unmatched.delete(matchId)
        if (match.sortOrder !== index) {
          console.log(`  ~ [${periodKey}] #${match.id} sortOrder ${match.sortOrder} -> ${index} :: ${text.slice(0, 60)}`)
          reordered++
          if (apply) {
            await prisma.goal.update({ where: { id: match.id }, data: { sortOrder: index } })
          }
        }
      } else {
        console.log(`  + [${periodKey}] создать :: ${text.slice(0, 60)}`)
        created++
        if (apply) {
          await prisma.goal.create({
            data: { userId: pg.userId, text, periodType, periodKey, sortOrder: index },
          })
        }
      }
    }
  }

  console.log(`\nИтого: PeriodGoal строк ${periodGoals.length}, создать записей ${created}, поправить порядок ${reordered}.`)

  if (!apply) return

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "data_migrations" (
      "name" TEXT PRIMARY KEY,
      "applied_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
  await prisma.$executeRaw`INSERT INTO "data_migrations" ("name") VALUES (${MIGRATION_NAME}) ON CONFLICT ("name") DO NOTHING`
  console.log('Готово, маркер записан.')
}

main()
  .catch(e => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
