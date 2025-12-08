import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const DailyEntrySchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  planText: z.string().optional(),
  factText: z.string().optional(),
  selectedTasksJson: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateStr = searchParams.get('date')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Get single entry by date
    if (dateStr) {
      const date = new Date(dateStr)
      const entry = await prisma.dailyEntry.findUnique({
        where: { date },
        include: { evaluation: true },
      })

      return NextResponse.json(entry || null)
    }

    // Get list of entries
    if (from && to) {
      const entries = await prisma.dailyEntry.findMany({
        where: {
          date: {
            gte: new Date(from),
            lte: new Date(to),
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

    const { date, planText, factText, selectedTasksJson } = validation.data
    const entryDate = new Date(date)

    // Upsert daily entry
    const entry = await prisma.dailyEntry.upsert({
      where: { date: entryDate },
      update: {
        ...(planText !== undefined && { planText }),
        ...(factText !== undefined && { factText }),
        ...(selectedTasksJson !== undefined && { selectedTasksJson }),
      },
      create: {
        date: entryDate,
        planText: planText || '',
        factText: factText || '',
        selectedTasksJson: selectedTasksJson || null,
      },
      include: { evaluation: true },
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Error creating daily entry:', error)
    return NextResponse.json({ error: 'Failed to create daily entry' }, { status: 500 })
  }
}
