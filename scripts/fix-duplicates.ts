import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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
  // Step 1: Delete junk entries ("ыф", "sa")
  const junkResult = await prisma.periodGoal.deleteMany({
    where: { id: { in: [140, 142, 144] } }
  })
  console.log('Deleted junk entries:', junkResult.count)

  // Step 2: Find and remove duplicates (same userId + periodType + periodStart)
  const all = await prisma.periodGoal.findMany({
    orderBy: [{ userId: 'asc' }, { periodType: 'asc' }, { periodStart: 'asc' }, { updatedAt: 'desc' }],
    select: { id: true, userId: true, periodType: true, periodStart: true, goalsJson: true, updatedAt: true }
  })

  const seen = new Map<string, typeof all[0]>()
  const toDelete: number[] = []

  for (const pg of all) {
    const key = `${pg.userId}|${pg.periodType}|${pg.periodStart.toISOString()}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, pg)
    } else {
      const keptGoals = safeParseJsonArray(existing.goalsJson)
      const pgGoals = safeParseJsonArray(pg.goalsJson)
      if (pgGoals.filter(g => g.trim()).length > keptGoals.filter(g => g.trim()).length) {
        toDelete.push(existing.id)
        seen.set(key, pg)
      } else {
        toDelete.push(pg.id)
      }
    }
  }

  console.log(`Total records: ${all.length}, Unique: ${seen.size}, Duplicates: ${toDelete.length}`)

  if (toDelete.length > 0) {
    const result = await prisma.periodGoal.deleteMany({ where: { id: { in: toDelete } } })
    console.log(`Deleted duplicates: ${result.count}`)
  }

  // Step 3: Show data state for 2026
  const goals2026 = await prisma.goal.findMany({ where: { periodKey: { startsWith: '2026' } } })
  console.log('\nGoal records for 2026:')
  for (const g of goals2026) {
    console.log(`  periodKey=${g.periodKey} text="${g.text.slice(0, 50)}" completed=${g.completed}`)
  }

  const pgs2026 = await prisma.periodGoal.findMany({
    where: { periodStart: { gte: new Date('2026-01-01'), lt: new Date('2027-01-01') } },
    orderBy: [{ periodType: 'asc' }, { periodStart: 'asc' }],
    select: { id: true, periodType: true, periodStart: true, goalsJson: true }
  })
  console.log('\nPeriodGoal records for 2026:')
  for (const pg of pgs2026) {
    console.log(`  [${pg.id}] ${pg.periodType} ${pg.periodStart.toISOString().slice(0, 10)} ${JSON.stringify(pg.goalsJson)}`)
  }

  await prisma.$disconnect()
}

main().catch(console.error)
