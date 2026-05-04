import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPeriodKey } from '@/lib/goals-utils'
import { safeParseJson } from '@/lib/api-utils'
import { requireUserId } from '@/lib/get-user-id'
import { mapGoalForResponse } from '@/lib/goal-response'
import type { YearGoalItem } from '@/lib/types'

function getActiveYears(months: number | null | undefined, currentYear: number): number[] {
  if (!months) return []

  const now = new Date()
  const endYear = months > 12
    ? new Date(now.getFullYear(), now.getMonth() + months, 1).getFullYear()
    : currentYear + 1

  return Array.from({ length: endYear - currentYear + 1 }, (_, index) => currentYear + index)
}

function parseYearGoals(raw: unknown): YearGoalItem[] {
  const goals = safeParseJson<Array<string | YearGoalItem>>(raw, [])
  return goals.map((goal, index) =>
    typeof goal === 'string'
      ? { id: `yg_legacy_${index}`, text: goal }
      : goal
  )
}

function buildYearEvaluations(evaluations: Array<{ dreamProgressScore: number; dailyEntry: { date: Date } }>) {
  const byYear: Record<number, { sum: number; count: number }> = {}

  for (const evaluation of evaluations) {
    const year = evaluation.dailyEntry.date.getFullYear()
    if (!byYear[year]) byYear[year] = { sum: 0, count: 0 }
    byYear[year].sum += evaluation.dreamProgressScore || 0
    byYear[year].count++
  }

  const result: Record<number, { avg: number; count: number }> = {}
  for (const [year, data] of Object.entries(byYear)) {
    result[Number(year)] = {
      avg: Math.round((data.sum / data.count) * 10) / 10,
      count: data.count,
    }
  }

  return result
}

function buildDreamProgress(params: {
  dreamMonths: number | null | undefined
  evaluations: Array<{ dreamProgressScore: number }>
  dreamTasks: Array<{ completed: boolean; periodType: string }>
}) {
  const { dreamMonths, evaluations, dreamTasks } = params
  const targetDays = dreamMonths ? Math.round(dreamMonths * 30.44) : null

  if (evaluations.length === 0) {
    return {
      total: targetDays || 1,
      completed: 0,
      percent: 0,
    }
  }

  const totalScore = evaluations.reduce((sum, evaluation) => sum + (evaluation.dreamProgressScore || 0), 0)
  const effectiveDays = totalScore / 10
  const evalPercent = targetDays ? Math.min(100, (effectiveDays / targetDays) * 100) : 0

  const periodWeight: Record<string, number> = {
    half_year: 8,
    quarter: 4,
    month: 2,
    week: 1,
  }

  let taskPercent = 0
  if (dreamTasks.length > 0) {
    let totalWeight = 0
    let completedWeight = 0
    for (const task of dreamTasks) {
      const weight = periodWeight[task.periodType] ?? 1
      totalWeight += weight
      if (task.completed) completedWeight += weight
    }
    taskPercent = totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0
  }

  const progressPercent = dreamTasks.length > 0
    ? taskPercent * 0.7 + evalPercent * 0.3
    : evalPercent

  return {
    total: targetDays || 1,
    completed: Math.round(effectiveDays || 0),
    percent: Math.round(progressPercent),
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const currentYear = new Date().getFullYear()
    const requestedYear = Number(request.nextUrl.searchParams.get('year') || currentYear)

    if (!Number.isInteger(requestedYear) || requestedYear < 2020 || requestedYear > 2100) {
      return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 })
    }

    const yearStart = new Date(requestedYear, 0, 1)
    const nextYearStart = new Date(requestedYear + 1, 0, 1)

    const [latestDream, earliestDream, yearGoalRows, periodGoalRows, goalRows, tags, evaluations, dreamTasks] = await prisma.$transaction([
      prisma.dreamGoal.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.dreamGoal.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      prisma.yearGoal.findMany({ where: { userId }, orderBy: { year: 'asc' } }),
      prisma.periodGoal.findMany({
        where: {
          userId,
          periodType: { in: ['half_year', 'quarter', 'month', 'week'] },
          periodStart: { gte: yearStart, lt: nextYearStart },
        },
        orderBy: [{ periodStart: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.goal.findMany({
        where: { userId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.goalTag.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
      prisma.evaluation.findMany({
        where: { dailyEntry: { userId } },
        select: {
          dreamProgressScore: true,
          dailyEntry: { select: { date: true } },
        },
      }),
      prisma.goal.findMany({
        where: { userId, rootYearGoalId: { not: null } },
        select: { completed: true, periodType: true },
      }),
    ])

    const dreamGoal = latestDream
      ? { ...latestDream, createdAt: earliestDream?.createdAt || latestDream.createdAt }
      : null

    const activeYears = getActiveYears(dreamGoal?.months, currentYear)
    const yearGoals: Record<string, YearGoalItem[]> = {}
    const archivedYearGoalYears: number[] = []

    for (const row of yearGoalRows) {
      const parsed = parseYearGoals(row.goalsJson)
      yearGoals[String(row.year)] = parsed
      if (row.year < currentYear && parsed.length > 0) {
        archivedYearGoalYears.push(row.year)
      }
    }

    for (const year of activeYears) {
      if (!yearGoals[String(year)]) yearGoals[String(year)] = []
    }
    if (!yearGoals[String(requestedYear)]) yearGoals[String(requestedYear)] = []

    const periodGoals: Record<string, string[]> = {}
    for (const row of periodGoalRows) {
      const key = getPeriodKey(row.periodType as 'half_year' | 'quarter' | 'month' | 'week', row.periodStart)
      if (!key || periodGoals[key]) continue
      periodGoals[key] = safeParseJson<string[]>(row.goalsJson, [])
    }

    return NextResponse.json({
      dreamGoal,
      activeYears,
      archivedYearGoalYears,
      yearGoals,
      periodGoals,
      goals: goalRows.map(mapGoalForResponse),
      tags,
      dreamProgress: buildDreamProgress({
        dreamMonths: dreamGoal?.months,
        evaluations,
        dreamTasks,
      }),
      yearEvaluations: buildYearEvaluations(evaluations),
    })
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error fetching goals context:', error)
    return NextResponse.json({ error: 'Failed to fetch goals context' }, { status: 500 })
  }
}