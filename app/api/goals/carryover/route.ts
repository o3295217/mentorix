// Ревизия месяца: незакрытые цели прошлого месяца (записи Goal).
// GET — список для напоминания при входе.
// POST — решения: отметить выполненной, перенести в неделю текущего месяца
// или отправить в бэклог задач.

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { requireUserId } from '@/lib/get-user-id'
import { safeParseJson } from '@/lib/api-utils'
import { areTasksSimilar } from '@/lib/task-match'
import { fuzzyMatchGoal, getMonthWeeks } from '@/lib/goals-utils'
import { collectCarryoverItems, monthKeyOf, prevMonthOf } from '@/lib/carryover'
import { syncCompletedWorkForGoal } from '@/lib/completed-work'

function monthScope(now: Date) {
  const prev = prevMonthOf(now)
  const currentKey = monthKeyOf(now.getFullYear(), now.getMonth())
  const prevKeys = [prev.key, ...getMonthWeeks(prev.year, prev.month).map(w => w.key)]
  const currentKeys = [currentKey, ...getMonthWeeks(now.getFullYear(), now.getMonth()).map(w => w.key)]
  return { prev, currentKey, prevKeys, currentKeys }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const now = new Date()
    const { prev, prevKeys, currentKeys } = monthScope(now)

    const [rows, openTasks] = await Promise.all([
      prisma.goal.findMany({
        where: { userId, periodKey: { in: [...prevKeys, ...currentKeys] } },
        select: { id: true, text: true, periodKey: true, completed: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
      prisma.openTask.findMany({ where: { userId, isClosed: false }, select: { taskText: true } }),
    ])

    const currentKeySet = new Set(currentKeys)
    const items = collectCarryoverItems({
      prevMonthKey: prev.key,
      prevKeys,
      rows,
      currentMonthTexts: rows.filter(r => currentKeySet.has(r.periodKey)).map(r => r.text),
      openTaskTexts: openTasks.map(t => t.taskText),
    })

    return NextResponse.json({ month: prev.key, items })
  } catch (error) {
    console.error('Error fetching carryover:', error)
    return NextResponse.json({ error: 'Failed to fetch carryover' }, { status: 500 })
  }
}

const DecisionSchema = z.object({
  goalId: z.number().int().positive().optional(),
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

type HistoryEntry = Record<string, unknown>

const pushHistory = (raw: unknown, entry: HistoryEntry): Prisma.InputJsonValue => {
  const history = safeParseJson<HistoryEntry[]>(raw, [])
  history.push(entry)
  return history as Prisma.InputJsonValue
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
    const { prev, prevKeys } = monthScope(now)
    const prevKeySet = new Set(prevKeys)
    const currentWeeks = new Map(getMonthWeeks(now.getFullYear(), now.getMonth()).map(w => [w.key, w]))
    const prevMonthEnd = new Date(prev.year, prev.month + 1, 0)

    const results: Array<{ text: string; success: boolean; action: string }> = []

    for (const decision of validation.data.decisions) {
      const { goalId, text, fromKey, action } = decision

      if (!prevKeySet.has(fromKey)) {
        results.push({ text, success: false, action: 'invalid_from_key' })
        continue
      }

      try {
        // Цель ищем по id (основной путь), с фолбэком по ключу и тексту
        let goal = goalId
          ? await prisma.goal.findFirst({ where: { id: goalId, userId } })
          : null
        if (!goal) {
          const candidates = await prisma.goal.findMany({ where: { userId, periodKey: fromKey } })
          goal = candidates.find(g => fuzzyMatchGoal(g.text, text)) ?? null
        }

        if (action.type === 'completed') {
          // Цель сделана, но не отмечена: та же цепочка, что и на странице целей
          if (!goal) {
            goal = await prisma.goal.create({
              data: { userId, text, periodType: fromKey.includes('-W') ? 'week' : 'month', periodKey: fromKey },
            })
          }
          if (!goal.completed) {
            const completedAt = new Date()
            await prisma.goal.update({
              where: { id: goal.id },
              data: {
                completed: true,
                completedAt,
                historyJson: pushHistory(goal.historyJson, { type: 'completed', date: completedAt.toISOString() }),
              },
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
          if (!goal) {
            results.push({ text, success: false, action: 'goal_not_found' })
            continue
          }
          await prisma.goal.update({
            where: { id: goal.id },
            data: {
              periodType: 'week',
              periodKey: week.key,
              historyJson: pushHistory(goal.historyJson, {
                type: 'moved',
                date: new Date().toISOString(),
                from: { periodType: goal.periodType, periodKey: goal.periodKey },
                to: { periodType: 'week', periodKey: week.key },
              }),
            },
          })
          results.push({ text, success: true, action: `moved_to_${week.key}` })
        } else {
          // В бэклог: цель превращается в задачу с флагом месяца-источника
          const openTasks = await prisma.openTask.findMany({
            where: { userId, isClosed: false },
            select: { taskText: true },
          })
          if (!openTasks.some(t => areTasksSimilar(t.taskText, text))) {
            await prisma.openTask.create({
              data: {
                userId,
                taskText: goal?.text ?? text,
                taskType: 'strategic',
                originDate: prevMonthEnd,
                carriedFromMonth: prev.key,
              },
            })
          }
          if (goal) {
            await prisma.goal.delete({ where: { id: goal.id } })
          }
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
