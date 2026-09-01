// Ревизия месяца: незакрытые цели прошлого месяца.
// GET — список для напоминания при входе.
// POST — решения: перенос цели в неделю текущего месяца или все в бэклог задач.

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { requireUserId } from '@/lib/get-user-id'
import { safeParseJson } from '@/lib/api-utils'
import { areTasksSimilar } from '@/lib/task-match'
import { fuzzyMatchGoal, getMonthWeeks, getWeekOfDate, MonthWeek } from '@/lib/goals-utils'
import { collectCarryoverItems, monthKeyOf, prevMonthOf, CarryoverSource } from '@/lib/carryover'
import { syncCompletedWorkForGoal } from '@/lib/completed-work'

const WEEK_KEY_RE = /^\d{4}-\d{2}-W\d+$/
const MONTH_KEY_RE = /^\d{4}-\d{2}$/

// PeriodGoal.periodStart хранится как полночь в часовом поясе создателя записи;
// сдвиг на +12ч перед определением дня/месяца прощает разницу поясов до ±12ч.
const normalizePeriodStart = (d: Date): Date => new Date(d.getTime() + 12 * 3600 * 1000)

interface PeriodGoalRow {
  id: number
  periodType: string
  periodStart: Date
  goalsJson: unknown
}

// Все PeriodGoal (месяцы и недели) в окне «прошлый месяц … текущий месяц»
async function loadPeriodGoalRows(userId: string, now: Date): Promise<PeriodGoalRow[]> {
  const prev = prevMonthOf(now)
  const rangeStart = new Date(prev.year, prev.month, 1)
  rangeStart.setDate(rangeStart.getDate() - 9) // первая ISO-неделя месяца может начаться в прошлом месяце
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 9)
  return prisma.periodGoal.findMany({
    where: {
      userId,
      periodType: { in: ['month', 'week'] },
      periodStart: { gte: rangeStart, lte: rangeEnd },
    },
    select: { id: true, periodType: true, periodStart: true, goalsJson: true },
  })
}

const rowTexts = (row: PeriodGoalRow): string[] =>
  safeParseJson<Array<string | { text: string }>>(row.goalsJson, [])
    .map(g => (typeof g === 'string' ? g : g?.text))
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)

// Месяц-владелец строки PeriodGoal: для месяца — сам месяц, для недели — месяц её четверга (ISO)
function rowOwnerMonth(row: PeriodGoalRow): { key: string; weekKey?: string } {
  const norm = normalizePeriodStart(row.periodStart)
  if (row.periodType === 'month') {
    return { key: monthKeyOf(norm.getFullYear(), norm.getMonth()) }
  }
  const week = getWeekOfDate(norm)
  return { key: monthKeyOf(week.year, week.month), weekKey: week.key }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const now = new Date()
    const prev = prevMonthOf(now)
    const currentKey = monthKeyOf(now.getFullYear(), now.getMonth())

    const rows = await loadPeriodGoalRows(userId, now)

    const sources: CarryoverSource[] = []
    const currentMonthTexts: string[] = []
    // Месячные источники первыми — дедуп в collectCarryoverItems предпочитает их
    for (const row of rows.sort((a, b) => (a.periodType === b.periodType ? 0 : a.periodType === 'month' ? -1 : 1))) {
      const owner = rowOwnerMonth(row)
      if (owner.key === prev.key) {
        sources.push({ key: owner.weekKey ?? prev.key, type: owner.weekKey ? 'week' : 'month', texts: rowTexts(row) })
      } else if (owner.key === currentKey) {
        currentMonthTexts.push(...rowTexts(row))
      }
    }

    const [tracked, openTasks] = await Promise.all([
      prisma.goal.findMany({ where: { userId }, select: { periodKey: true, text: true, completed: true } }),
      prisma.openTask.findMany({ where: { userId, isClosed: false }, select: { taskText: true } }),
    ])

    const items = collectCarryoverItems({
      sources,
      tracked,
      currentMonthTexts,
      openTaskTexts: openTasks.map(t => t.taskText),
      monthKey: prev.key,
    })

    return NextResponse.json({ month: prev.key, items })
  } catch (error) {
    console.error('Error fetching carryover:', error)
    return NextResponse.json({ error: 'Failed to fetch carryover' }, { status: 500 })
  }
}

const DecisionSchema = z.object({
  text: z.string().min(1),
  fromKey: z.string().min(1),
  action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('week'), weekKey: z.string().min(1) }),
    z.object({ type: z.literal('backlog') }),
    z.object({ type: z.literal('completed') }),
  ]),
})

const CarryoverPostSchema = z.object({
  decisions: z.array(DecisionSchema).min(1),
})

// Убрать текст цели из goalsJson строки PeriodGoal (точное совпадение, иначе нечёткое)
async function removeTextFromRow(row: PeriodGoalRow, text: string): Promise<void> {
  const texts = rowTexts(row)
  let index = texts.findIndex(t => t === text)
  if (index === -1) index = texts.findIndex(t => areTasksSimilar(t, text))
  if (index === -1) return
  texts.splice(index, 1)
  await prisma.periodGoal.update({ where: { id: row.id }, data: { goalsJson: texts } })
}

// Добавить текст цели в PeriodGoal недели (создаёт запись недели при отсутствии)
async function addTextToWeek(userId: string, week: MonthWeek, text: string): Promise<void> {
  const dayBefore = new Date(week.start)
  dayBefore.setDate(dayBefore.getDate() - 1)
  const dayAfter = new Date(week.start)
  dayAfter.setDate(dayAfter.getDate() + 1)

  const existing = await prisma.periodGoal.findFirst({
    where: { userId, periodType: 'week', periodStart: { gte: dayBefore, lte: dayAfter } },
  })

  if (existing) {
    const texts = rowTexts(existing as PeriodGoalRow)
    if (!texts.some(t => areTasksSimilar(t, text))) {
      await prisma.periodGoal.update({ where: { id: existing.id }, data: { goalsJson: [...texts, text] } })
    }
  } else {
    await prisma.periodGoal.create({
      data: { userId, periodType: 'week', periodStart: week.start, periodEnd: week.end, goalsJson: [text] },
    })
  }
}

// Перенести незакрытую tracked-запись цели в новую неделю (если она есть)
async function moveTrackedGoal(userId: string, fromKey: string, text: string, toWeekKey: string): Promise<void> {
  const candidates = await prisma.goal.findMany({ where: { userId, periodKey: fromKey, completed: false } })
  const goal = candidates.find(g => fuzzyMatchGoal(g.text, text))
  if (!goal) return

  const history = safeParseJson<Array<Record<string, unknown>>>(goal.historyJson, [])
  history.push({
    type: 'moved',
    date: new Date().toISOString(),
    from: { periodType: goal.periodType, periodKey: goal.periodKey },
    to: { periodType: 'week', periodKey: toWeekKey },
  })
  await prisma.goal.update({
    where: { id: goal.id },
    data: { periodType: 'week', periodKey: toWeekKey, historyJson: history as Prisma.InputJsonValue },
  })
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()

    const validation = CarryoverPostSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const now = new Date()
    const prev = prevMonthOf(now)
    const prevWeekKeys = new Set(getMonthWeeks(prev.year, prev.month).map(w => w.key))
    const currentWeeks = new Map(getMonthWeeks(now.getFullYear(), now.getMonth()).map(w => [w.key, w]))
    const prevMonthEnd = new Date(prev.year, prev.month + 1, 0)

    const results: Array<{ text: string; success: boolean; action: string }> = []

    for (const decision of validation.data.decisions) {
      const { text, fromKey, action } = decision

      const validFrom = fromKey === prev.key
        ? MONTH_KEY_RE.test(fromKey)
        : WEEK_KEY_RE.test(fromKey) && prevWeekKeys.has(fromKey)
      if (!validFrom) {
        results.push({ text, success: false, action: 'invalid_from_key' })
        continue
      }

      try {
        // Строка-источник ищется по свежим данным на каждой итерации:
        // предыдущие решения могли изменить goalsJson
        const rows = await loadPeriodGoalRows(userId, now)
        const sourceRow = rows.find(row => {
          const owner = rowOwnerMonth(row)
          return fromKey === prev.key ? owner.key === prev.key && row.periodType === 'month' : owner.weekKey === fromKey
        })

        if (action.type === 'completed') {
          // Цель сделана, но не отмечена: ставим галочку тем же путём, что и
          // страница целей. Текст из PeriodGoal не убираем — выполненная цель
          // остаётся в своём месяце и учитывается в его прогрессе.
          const candidates = await prisma.goal.findMany({ where: { userId, periodKey: fromKey } })
          let goal = candidates.find(g => fuzzyMatchGoal(g.text, text))
          if (!goal) {
            goal = await prisma.goal.create({
              data: { userId, text, periodType: WEEK_KEY_RE.test(fromKey) ? 'week' : 'month', periodKey: fromKey },
            })
          }
          if (!goal.completed) {
            const history = safeParseJson<Array<Record<string, unknown>>>(goal.historyJson, [])
            history.push({ type: 'completed', date: new Date().toISOString() })
            const completedAt = new Date()
            await prisma.goal.update({
              where: { id: goal.id },
              data: { completed: true, completedAt, historyJson: history as Prisma.InputJsonValue },
            })
            await syncCompletedWorkForGoal({ userId, goalId: goal.id, goalText: goal.text, periodKey: goal.periodKey, completedAt })
          }
          results.push({ text, success: true, action: 'marked_completed' })
        } else if (action.type === 'week') {
          const week = currentWeeks.get(action.weekKey)
          if (!week) {
            results.push({ text, success: false, action: 'invalid_week_key' })
            continue
          }
          await addTextToWeek(userId, week, text)
          await moveTrackedGoal(userId, fromKey, text, week.key)
          if (sourceRow) await removeTextFromRow(sourceRow, text)
          results.push({ text, success: true, action: `moved_to_${week.key}` })
        } else {
          const openTasks = await prisma.openTask.findMany({
            where: { userId, isClosed: false },
            select: { taskText: true },
          })
          if (!openTasks.some(t => areTasksSimilar(t.taskText, text))) {
            await prisma.openTask.create({
              data: {
                userId,
                taskText: text,
                taskType: 'strategic',
                originDate: prevMonthEnd,
                carriedFromMonth: prev.key,
              },
            })
          }
          if (sourceRow) await removeTextFromRow(sourceRow, text)
          results.push({ text, success: true, action: 'moved_to_backlog' })
        }
      } catch (error) {
        console.error(`Error processing carryover decision for "${text}":`, error)
        results.push({ text, success: false, action: 'error' })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('Error processing carryover decisions:', error)
    return NextResponse.json({ error: 'Failed to process carryover decisions' }, { status: 500 })
  }
}
