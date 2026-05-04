import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

function safeParseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value !== 'string' || value.length === 0) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

async function main() {
  const allQ = await p.periodGoal.findMany({
    where: { periodType: 'quarter' },
    orderBy: { periodStart: 'asc' },
    select: { id: true, periodStart: true, periodEnd: true, goalsJson: true, updatedAt: true }
  })
  console.log('All quarter PeriodGoals:')
  for (const pg of allQ) {
    const goals = safeParseJsonArray(pg.goalsJson)
    console.log(`  [${pg.id}] ${pg.periodStart.toISOString().slice(0,10)} → ${pg.periodEnd.toISOString().slice(0,10)} goals=${goals.length}: ${JSON.stringify(goals.map((g: string) => g.slice(0, 50)))} updated=${pg.updatedAt.toISOString()}`)
  }
  await p.$disconnect()
}
main()
