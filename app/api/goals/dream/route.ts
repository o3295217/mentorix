import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const DreamGoalSchema = z.object({
  goalText: z.string().min(1, "Goal text is required"),
  years: z.number().int().min(1).max(10).optional().default(5),
})

export async function GET() {
  try {
    const dream = await prisma.dreamGoal.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(dream || null)
  } catch (error) {
    console.error('Error fetching dream goal:', error)
    return NextResponse.json({ error: 'Failed to fetch dream goal' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const validation = DreamGoalSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { goalText, years } = validation.data

    // Create or update dream goal (we only keep one)
    const dream = await prisma.dreamGoal.create({
      data: {
        goalText,
        years,
      },
    })

    return NextResponse.json(dream)
  } catch (error) {
    console.error('Error creating dream goal:', error)
    return NextResponse.json({ error: 'Failed to create dream goal' }, { status: 500 })
  }
}
