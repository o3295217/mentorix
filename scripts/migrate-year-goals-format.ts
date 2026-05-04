/**
 * Миграция данных: конвертирует YearGoal.goalsJson из string[] в {id, text}[]
 * и устанавливает scope='dream' на существующих Goal записях без scope.
 *
 * Запуск: ENCRYPTION_KEY=... npx tsx scripts/migrate-year-goals-format.ts
 */

import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'
import { randomBytes } from 'crypto'

function generateYearGoalId(): string {
  return 'yg_' + randomBytes(6).toString('hex')
}

function safeParseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' || value.length === 0) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function isYearGoalItem(value: unknown): value is { id: string; text: string } {
  return typeof value === 'object'
    && value !== null
    && 'id' in value
    && 'text' in value
    && typeof value.id === 'string'
    && typeof value.text === 'string'
}

async function main() {
  // 1. Migrate YearGoal.goalsJson from string[] to {id, text}[]
  const yearGoals = await prisma.yearGoal.findMany()
  let converted = 0

  for (const yg of yearGoals) {
    try {
      const parsed = safeParseJsonArray(yg.goalsJson)
      if (!Array.isArray(parsed) || parsed.length === 0) continue

      // Already migrated?
      if (isYearGoalItem(parsed[0])) continue

      // Convert string[] → {id, text}[]
      const items = parsed.map((item: unknown) => ({
        id: generateYearGoalId(),
        text: typeof item === 'string' ? item : String(item),
      }))

      await prisma.yearGoal.update({
        where: { id: yg.id },
        data: { goalsJson: items as Prisma.InputJsonValue },
      })
      converted++
    } catch {
      console.error(`Failed to parse goalsJson for YearGoal ${yg.id}`)
    }
  }

  console.log(`YearGoal: converted ${converted} of ${yearGoals.length} records`)

  // 2. Set scope='dream' on existing Goal records without scope
  const result = await prisma.goal.updateMany({
    where: { scope: null },
    data: { scope: 'dream' },
  })

  console.log(`Goal: set scope='dream' on ${result.count} records`)
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
