import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { requireUserId } from '@/lib/get-user-id'

const DreamGoalSchema = z.object({
  goalText: z.string().min(1, "Goal text is required"),
  years: z.number().int().min(1).max(30).optional().default(5),
})

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const [latestDream, earliestDream] = await prisma.$transaction([
      prisma.dreamGoal.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dreamGoal.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ])

    const dream = latestDream
      ? {
          ...latestDream,
          createdAt: earliestDream?.createdAt || latestDream.createdAt,
        }
      : null

    return NextResponse.json(dream || null)
  } catch (error) {
    const statusCode = (error as any)?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error fetching dream goal:', error)
    return NextResponse.json({ error: 'Failed to fetch dream goal' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    
    const validation = DreamGoalSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { goalText, years } = validation.data

    const dream = await prisma.$transaction(async (tx) => {
      const existingDreams = await tx.dreamGoal.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })

      if (existingDreams.length === 0) {
        return tx.dreamGoal.create({
          data: {
            userId,
            goalText,
            years,
          },
        })
      }

      const canonicalDream = existingDreams[0]

      const updatedDream = await tx.dreamGoal.update({
        where: { id: canonicalDream.id },
        data: {
          goalText,
          years,
        },
      })

      if (existingDreams.length > 1) {
        await tx.dreamGoal.deleteMany({
          where: {
            userId,
            id: { not: canonicalDream.id },
          },
        })
      }

      return updatedDream
    })

    return NextResponse.json(dream)
  } catch (error) {
    const statusCode = (error as any)?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error creating dream goal:', error)
    return NextResponse.json({ error: 'Failed to create dream goal' }, { status: 500 })
  }
}
