import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { parseDateParam, toDateKey } from '@/lib/dates'
import { splitLines } from '@/lib/fact-utils'
import { safeParseJson } from '@/lib/api-utils'
import { requireUserId } from '@/lib/get-user-id'
import { syncCompletedWorkForEntry, recalculateWorkSummary } from '@/lib/completed-work'
import { completeTrackedGoalsForTasks } from '@/lib/goal-completion-sync'
import { deriveCompletedTaskTexts } from '@/lib/goal-task-match'
import { buildPaginatedResponse, parsePaginationParams } from '@/lib/pagination'
import { Prisma } from '@prisma/client'

const DailyEntrySchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  planText: z.string().optional(),
  factText: z.string().optional(),
  selectedTasksJson: z.string().optional().nullable(),
  extraTasksJson: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const searchParams = request.nextUrl.searchParams
    const dateStr = searchParams.get('date')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const { limit, offset } = parsePaginationParams(searchParams, { defaultLimit: 100 })

    // Get single entry by date
    if (dateStr) {
      const requestedDateKey = dateStr.match(/^\d{4}-\d{2}-\d{2}$/) 
        ? dateStr 
        : toDateKey(parseDateParam(dateStr))
      
      // Парсим дату и ищем в диапазоне ±1 день для учёта часовых поясов
      const localDate = parseDateParam(requestedDateKey)
      const dayBefore = new Date(localDate)
      dayBefore.setDate(dayBefore.getDate() - 1)
      const dayAfter = new Date(localDate)
      dayAfter.setDate(dayAfter.getDate() + 2)
      
      const entries = await prisma.dailyEntry.findMany({
        where: {
          userId,
          date: {
            gte: dayBefore,
            lt: dayAfter,
          },
        },
        include: { evaluation: true },
      })
      
      // Фильтруем по локальной дате
      const entry = entries.find(e => toDateKey(e.date) === requestedDateKey)
      
      console.log('[API daily GET]', requestedDateKey, 'userId:', userId, 'found:', !!entry, 'planText length:', entry?.planText?.length, 'selectedTasksJson:', entry?.selectedTasksJson)

      return NextResponse.json(entry || null)
    }

    // Get list of entries
    if (from && to) {
      const where: Prisma.DailyEntryWhereInput = {
        userId,
        date: {
          gte: parseDateParam(from),
          lte: parseDateParam(to),
        },
        // Фильтруем пустые записи (без плана И без факта)
        OR: [
          { planText: { not: null } },
          { factText: { not: null } },
        ],
      }
      const [entries, total] = await Promise.all([
        prisma.dailyEntry.findMany({
          where,
          include: { evaluation: true },
          orderBy: { date: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.dailyEntry.count({ where }),
      ])

      return NextResponse.json(buildPaginatedResponse({ items: entries, total, limit, offset }))
    }

    // Получить записи для истории
    const where: Prisma.DailyEntryWhereInput = {
      userId,
      OR: [
        { planText: { not: null } },
        { factText: { not: null } },
      ],
    }
    const [entries, total] = await Promise.all([
      prisma.dailyEntry.findMany({
        where,
        include: { evaluation: true },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.dailyEntry.count({ where }),
    ])

    return NextResponse.json(buildPaginatedResponse({ items: entries, total, limit, offset }))
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error fetching daily entries:', error)
    return NextResponse.json({ error: 'Failed to fetch daily entries' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    
    // Validate input using Zod
    const validation = DailyEntrySchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { date, planText, factText, selectedTasksJson, extraTasksJson } = validation.data
    const selectedTasksValue = selectedTasksJson === undefined
      ? undefined
      : selectedTasksJson === null
        ? Prisma.DbNull
        : safeParseJson<Array<string | number>>(selectedTasksJson, []) as unknown as Prisma.InputJsonValue
    const extraTasksValue = extraTasksJson === undefined
      ? undefined
      : safeParseJson<string[]>(extraTasksJson, []) as unknown as Prisma.InputJsonValue
    
    // Нормализуем дату к формату YYYY-MM-DD
    const requestedDateKey = date.match(/^\d{4}-\d{2}-\d{2}$/) 
      ? date 
      : toDateKey(parseDateParam(date))
    const entryDate = parseDateParam(requestedDateKey)
    
    // Ищем в диапазоне ±1 день для учёта часовых поясов (как в GET)
    const dayBefore = new Date(entryDate)
    dayBefore.setDate(dayBefore.getDate() - 1)
    const dayAfter = new Date(entryDate)
    dayAfter.setDate(dayAfter.getDate() + 2)
    
    const existingEntries = await prisma.dailyEntry.findMany({
      where: { 
        userId, 
        date: {
          gte: dayBefore,
          lt: dayAfter,
        },
      },
      select: { id: true, date: true, planSnapshotJson: true },
    })
    
    // Находим запись по локальной дате
    const existing = existingEntries.find(e => toDateKey(e.date) === requestedDateKey)
    
    console.log('[API daily POST]', requestedDateKey, 'userId:', userId, 'existingId:', existing?.id, 'entriesFound:', existingEntries.length)

    const planLines = planText !== undefined ? splitLines(planText) : []
    const shouldSetSnapshot = planText !== undefined && planLines.length > 0 && !existing?.planSnapshotJson
    const planSnapshotJson = shouldSetSnapshot ? planLines as unknown as Prisma.InputJsonValue : undefined

    // Upsert daily entry
    const entry = existing
      ? await prisma.dailyEntry.update({
          where: { id: existing.id },
          data: {
            ...(planText !== undefined && { planText }),
            ...(factText !== undefined && { factText }),
            ...(selectedTasksValue !== undefined && { selectedTasksJson: selectedTasksValue }),
            ...(extraTasksValue !== undefined && { extraTasksJson: extraTasksValue }),
            ...(planSnapshotJson !== undefined && { planSnapshotJson }),
          },
          include: { evaluation: true },
        })
      : await prisma.dailyEntry.create({
          data: {
            userId,
            date: entryDate,
            planText: planText || '',
            factText: factText || '',
            selectedTasksJson: selectedTasksValue || Prisma.DbNull,
            extraTasksJson: extraTasksValue || [],
            planSnapshotJson: planLines.length > 0 ? planLines as unknown as Prisma.InputJsonValue : Prisma.DbNull,
          },
          include: { evaluation: true },
        })

    // Синхронизация CompletedWork (если есть отмеченные задачи)
    if (selectedTasksJson !== undefined || extraTasksJson !== undefined) {
      try {
        await syncCompletedWorkForEntry({
          userId,
          entryId: entry.id,
          date: entry.date,
          planText: entry.planText,
          selectedTasksJson: entry.selectedTasksJson,
          extraTasksJson: entry.extraTasksJson,
        })
      } catch (cwError) {
        console.error('[CompletedWork] sync failed:', cwError)
      }

      // Взаимная связь: выполненная задача дня отмечает совпавшую tracked-цель
      try {
        const completedGoals = await completeTrackedGoalsForTasks({
          userId,
          date: entry.date,
          taskTexts: deriveCompletedTaskTexts({
            planText: entry.planText,
            selectedTasksJson: entry.selectedTasksJson,
            extraTasksJson: entry.extraTasksJson,
          }),
        })
        if (completedGoals > 0) {
          console.log(`[GoalSync] completed ${completedGoals} tracked goal(s) from daily tasks`)
        }
      } catch (gsError) {
        console.error('[GoalSync] failed:', gsError)
      }

      try {
        await recalculateWorkSummary(userId, entry.date)
      } catch (wsError) {
        console.error('[WorkSummary] recalc failed:', wsError)
      }
    }

    return NextResponse.json(entry)
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error creating daily entry:', error)
    return NextResponse.json({ error: 'Failed to create daily entry' }, { status: 500 })
  }
}
