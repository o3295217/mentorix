const { PrismaClient } = require('@prisma/client')
const Database = require('better-sqlite3')

const sqliteDb = new Database('./prisma/dev.db', { readonly: true })
const pgClient = new PrismaClient()

// Helper function to convert SQLite timestamp (milliseconds) to Date
function toDate(val) {
  if (!val) return null
  // If it's already a number (milliseconds timestamp)
  if (typeof val === 'number') {
    return new Date(val)
  }
  // If it's an ISO string
  if (typeof val === 'string') {
    const date = new Date(val)
    if (!isNaN(date.getTime())) return date
  }
  return null
}

function toDateRequired(val) {
  const date = toDate(val)
  if (!date) throw new Error(`Invalid date: ${val}`)
  return date
}

async function migrate() {
  await pgClient.$connect()
  console.log('Connected to PostgreSQL')

  // Migrate users
  const users = sqliteDb.prepare('SELECT * FROM users').all()
  console.log(`Migrating ${users.length} users...`)
  for (const user of users) {
    try {
      await pgClient.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email: user.email,
          name: user.name,
          passwordHash: user.passwordHash,
          role: user.role || 'user',
          isActive: user.isActive === 1,
          createdAt: toDateRequired(user.createdAt),
          updatedAt: toDateRequired(user.updatedAt || user.createdAt),
        },
        update: {}
      })
    } catch (e) {
      console.log(`  User ${user.id} exists, skipping`)
    }
  }

  // Migrate dream goals
  const dreams = sqliteDb.prepare('SELECT * FROM dream_goal').all()
  console.log(`Migrating ${dreams.length} dream goals...`)
  for (const d of dreams) {
    try {
      await pgClient.dreamGoal.upsert({
        where: { id: d.id },
        create: {
          id: d.id,
          userId: d.userId,
          goalText: d.goalText,
          years: d.years || 5,
          createdAt: toDateRequired(d.createdAt),
          updatedAt: toDateRequired(d.updatedAt || d.createdAt),
        },
        update: {}
      })
    } catch (e) {
      console.log(`  Dream ${d.id} error:`, e.message)
    }
  }

  // Migrate year goals
  const years = sqliteDb.prepare('SELECT * FROM year_goals').all()
  console.log(`Migrating ${years.length} year goals...`)
  for (const y of years) {
    try {
      await pgClient.yearGoal.upsert({
        where: { id: y.id },
        create: {
          id: y.id,
          userId: y.userId,
          year: y.year,
          goalsJson: y.goalsJson,
          createdAt: toDateRequired(y.createdAt),
          updatedAt: toDateRequired(y.updatedAt || y.createdAt),
        },
        update: {}
      })
    } catch (e) {
      console.log(`  Year ${y.id} error:`, e.message)
    }
  }

  // Migrate period goals
  const periods = sqliteDb.prepare('SELECT * FROM period_goals').all()
  console.log(`Migrating ${periods.length} period goals...`)
  for (const p of periods) {
    try {
      await pgClient.periodGoal.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          userId: p.userId,
          periodType: p.periodType,
          periodStart: toDateRequired(p.periodStart),
          periodEnd: toDateRequired(p.periodEnd),
          goalsJson: p.goalsJson,
          createdAt: toDateRequired(p.createdAt),
          updatedAt: toDateRequired(p.updatedAt || p.createdAt),
        },
        update: {}
      })
    } catch (e) {
      console.log(`  Period ${p.id} error:`, e.message)
    }
  }

  // Migrate goal tags
  const tags = sqliteDb.prepare('SELECT * FROM goal_tags').all()
  console.log(`Migrating ${tags.length} goal tags...`)
  for (const t of tags) {
    try {
      await pgClient.goalTag.upsert({
        where: { id: t.id },
        create: {
          id: t.id,
          userId: t.userId,
          name: t.name,
          color: t.color || '#6B7280',
          createdAt: toDateRequired(t.createdAt),
        },
        update: {}
      })
    } catch (e) {
      console.log(`  Tag ${t.id} error:`, e.message)
    }
  }

  // Migrate goals
  const goals = sqliteDb.prepare('SELECT * FROM goals').all()
  console.log(`Migrating ${goals.length} goals...`)
  for (const g of goals) {
    try {
      await pgClient.goal.upsert({
        where: { id: g.id },
        create: {
          id: g.id,
          userId: g.userId,
          text: g.text,
          periodType: g.periodType,
          periodKey: g.periodKey,
          completed: g.completed === 1,
          completedAt: toDate(g.completedAt),
          deadline: toDate(g.deadline),
          priority: g.priority || 'medium',
          tagsJson: g.tagsJson || '[]',
          blockedByJson: g.blockedByJson || '[]',
          historyJson: g.historyJson || '[]',
          sortOrder: g.sortOrder || 0,
          createdAt: toDateRequired(g.createdAt),
          updatedAt: toDateRequired(g.updatedAt || g.createdAt),
        },
        update: {}
      })
    } catch (e) {
      console.log(`  Goal ${g.id} error:`, e.message)
    }
  }

  // Migrate open tasks
  const tasks = sqliteDb.prepare('SELECT * FROM open_tasks').all()
  console.log(`Migrating ${tasks.length} open tasks...`)
  for (const t of tasks) {
    try {
      await pgClient.openTask.upsert({
        where: { id: t.id },
        create: {
          id: t.id,
          userId: t.userId,
          taskText: t.taskText,
          taskType: t.taskType,
          originDate: toDateRequired(t.originDate),
          isClosed: t.isClosed === 1,
          closedAt: toDate(t.closedAt),
          createdAt: toDateRequired(t.createdAt),
        },
        update: {}
      })
    } catch (e) {
      console.log(`  Task ${t.id} error:`, e.message)
    }
  }

  // Migrate daily entries
  const entries = sqliteDb.prepare('SELECT * FROM daily_entries').all()
  console.log(`Migrating ${entries.length} daily entries...`)
  for (const e of entries) {
    try {
      await pgClient.dailyEntry.upsert({
        where: { id: e.id },
        create: {
          id: e.id,
          userId: e.userId,
          date: toDateRequired(e.date),
          planText: e.planText,
          factText: e.factText,
          planSnapshotJson: e.planSnapshotJson,
          extraTasksJson: e.extraTasksJson || '[]',
          emotionalState: e.emotionalState,
          physicalState: e.physicalState,
          lifeEvents: e.lifeEvents,
          externalFactors: e.externalFactors,
          energyLevel: e.energyLevel,
          sleepQuality: e.sleepQuality,
          familyTime: e.familyTime,
          exerciseTime: e.exerciseTime,
          selectedTasksJson: e.selectedTasksJson,
          createdAt: toDateRequired(e.createdAt),
          updatedAt: toDateRequired(e.updatedAt || e.createdAt),
        },
        update: {}
      })
    } catch (err) {
      console.log(`  Entry ${e.id} error:`, err.message)
    }
  }

  // Migrate evaluations
  const evals = sqliteDb.prepare('SELECT * FROM evaluations').all()
  console.log(`Migrating ${evals.length} evaluations...`)
  for (const ev of evals) {
    try {
      await pgClient.evaluation.upsert({
        where: { id: ev.id },
        create: {
          id: ev.id,
          dailyEntryId: ev.dailyEntryId,
          dreamProgressScore: ev.dreamProgressScore,
          strategyScore: ev.strategyScore,
          operationsScore: ev.operationsScore,
          teamScore: ev.teamScore,
          efficiencyScore: ev.efficiencyScore,
          overallScore: ev.overallScore,
          feedbackText: ev.feedbackText,
          planVsFactText: ev.planVsFactText,
          alignmentDayWeek: ev.alignmentDayWeek,
          alignmentWeekMonth: ev.alignmentWeekMonth,
          alignmentMonthQuarter: ev.alignmentMonthQuarter,
          alignmentQuarterHalf: ev.alignmentQuarterHalf,
          alignmentHalfYear: ev.alignmentHalfYear,
          alignmentYearDream: ev.alignmentYearDream,
          healthFlag: ev.healthFlag,
          familyFlag: ev.familyFlag,
          energyFlag: ev.energyFlag,
          workHealthAlignment: ev.workHealthAlignment,
          workFamilyAlignment: ev.workFamilyAlignment,
          workValuesAlignment: ev.workValuesAlignment,
          recommendationsText: ev.recommendationsText,
          suggestedTasksJson: ev.suggestedTasksJson,
          createdAt: toDateRequired(ev.createdAt),
        },
        update: {}
      })
    } catch (err) {
      console.log(`  Eval ${ev.id} error:`, err.message)
    }
  }

  // Migrate habits
  const habits = sqliteDb.prepare('SELECT * FROM habits').all()
  console.log(`Migrating ${habits.length} habits...`)
  for (const h of habits) {
    try {
      await pgClient.habit.upsert({
        where: { id: h.id },
        create: {
          id: h.id,
          userId: h.userId,
          taskText: h.taskText,
          frequency: h.frequency || 'daily',
          daysOfWeek: h.daysOfWeek,
          interval: h.interval,
          isActive: h.isActive === 1,
          streak: h.streak || 0,
          bestStreak: h.bestStreak || 0,
          totalDone: h.totalDone || 0,
          sortOrder: h.sortOrder || 0,
          createdAt: toDateRequired(h.createdAt),
          updatedAt: toDateRequired(h.updatedAt || h.createdAt),
        },
        update: {}
      })
    } catch (err) {
      console.log(`  Habit ${h.id} error:`, err.message)
    }
  }

  // Migrate user profiles
  const profiles = sqliteDb.prepare('SELECT * FROM user_profile').all()
  console.log(`Migrating ${profiles.length} user profiles...`)
  for (const p of profiles) {
    try {
      await pgClient.userProfile.upsert({
        where: { userId: p.userId },
        create: {
          userId: p.userId,
          name: p.name,
          occupation: p.occupation,
          industry: p.industry,
          maritalStatus: p.maritalStatus,
          hobbies: p.hobbies,
          sports: p.sports,
          location: p.location,
          age: p.age,
          customInterests: p.customInterests,
          education: p.education,
          teamSize: p.teamSize,
          workExperience: p.workExperience,
          values: p.values,
          challenges: p.challenges,
          other: p.other,
          createdAt: toDateRequired(p.createdAt),
          updatedAt: toDateRequired(p.updatedAt || p.createdAt),
        },
        update: {}
      })
    } catch (err) {
      console.log(`  Profile ${p.id} error:`, err.message)
    }
  }

  // Final verification
  const pgEntries = await pgClient.dailyEntry.count()
  const pgEvals = await pgClient.evaluation.count()
  const pgGoals = await pgClient.goal.count()
  const pgTasks = await pgClient.openTask.count()
  const pgHabits = await pgClient.habit.count()
  const pgPeriods = await pgClient.periodGoal.count()
  
  console.log('\n✅ Migration completed!')
  console.log('\nPostgreSQL now has:')
  console.log(`  - ${pgEntries} daily entries`)
  console.log(`  - ${pgEvals} evaluations`)
  console.log(`  - ${pgGoals} goals`)
  console.log(`  - ${pgTasks} open tasks`)
  console.log(`  - ${pgHabits} habits`)
  console.log(`  - ${pgPeriods} period goals`)

  await pgClient.$disconnect()
  sqliteDb.close()
}

migrate().catch(console.error)
