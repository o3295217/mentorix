import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const allQ = await p.periodGoal.findMany({
    where: { periodType: 'quarter' },
    orderBy: { periodStart: 'asc' },
    select: { id: true, periodStart: true, periodEnd: true, goalsJson: true, updatedAt: true }
  })
  console.log('All quarter PeriodGoals:')
  for (const pg of allQ) {
    const goals = JSON.parse(pg.goalsJson)
    console.log(`  [${pg.id}] ${pg.periodStart.toISOString().slice(0,10)} → ${pg.periodEnd.toISOString().slice(0,10)} goals=${goals.length}: ${JSON.stringify(goals.map((g: string) => g.slice(0, 50)))} updated=${pg.updatedAt.toISOString()}`)
  }
  await p.$disconnect()
}
main()
