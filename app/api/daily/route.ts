import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { parseDateParam, toDateKey } from '@/lib/dates'
import { splitLines } from '@/lib/fact-utils'

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
    const searchParams = request.nextUrl.searchParams
    const dateStr = searchParams.get('date')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

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
          date: {
            gte: dayBefore,
            lt: dayAfter,
          },
        },
        include: { evaluation: true },
      })
      
      // Фильтруем по локальной дате
      const entry = entries.find(e => toDateKey(e.date) === requestedDateKey)

      return NextResponse.json(entry || null)
    }

    // Get list of entries
    if (from && to) {
      const entries = await prisma.dailyEntry.findMany({
        where: {
          date: {
            gte: parseDateParam(from),
            lte: parseDateParam(to),
          },
        },
        include: { evaluation: true },
        orderBy: { date: 'desc' },
      })

      return NextResponse.json(entries)
    }

    return NextResponse.json({ error: 'date or from/to is required' }, { status: 400 })
  } catch (error) {
    console.error('Error fetching daily entries:', error)
    return NextResponse.json({ error: 'Failed to fetch daily entries' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
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
    const entryDate = parseDateParam(date)

    const existing = await prisma.dailyEntry.findUnique({
      where: { date: entryDate },
      select: { id: true, planSnapshotJson: true },
    })

    const planLines = planText !== undefined ? splitLines(planText) : []
    const shouldSetSnapshot = planText !== undefined && planLines.length > 0 && !existing?.planSnapshotJson
    const planSnapshotJson = shouldSetSnapshot ? JSON.stringify(planLines) : undefined

    // Upsert daily entry
    const entry = await prisma.dailyEntry.upsert({
      where: { date: entryDate },
      update: {
        ...(planText !== undefined && { planText }),
        ...(factText !== undefined && { factText }),
        ...(selectedTasksJson !== undefined && { selectedTasksJson }),
        ...(extraTasksJson !== undefined && { extraTasksJson }),
        ...(planSnapshotJson !== undefined && { planSnapshotJson }),
      },
      create: {
        date: entryDate,
        planText: planText || '',
        factText: factText || '',
        selectedTasksJson: selectedTasksJson || null,
        extraTasksJson: extraTasksJson || '[]',
        planSnapshotJson: planLines.length > 0 ? JSON.stringify(planLines) : null,
      },
      include: { evaluation: true },
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Error creating daily entry:', error)
    return NextResponse.json({ error: 'Failed to create daily entry' }, { status: 500 })
  }
}
