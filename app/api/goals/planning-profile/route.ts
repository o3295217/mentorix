import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'
import { z } from 'zod'

const PlanningProfileSchema = z.object({
  hoursPerWeek: z.union([z.coerce.number().int().min(0).max(168), z.null()]).optional(),
  experienceLevel: z.union([z.enum(['none', 'beginner', 'intermediate', 'expert']), z.literal(''), z.null()]).optional(),
  hasBudget: z.union([z.enum(['none', 'limited', 'available']), z.literal(''), z.null()]).optional(),
  currentWorkload: z.union([z.enum(['fulltime', 'parttime', 'freelance', 'free']), z.literal(''), z.null()]).optional(),
  constraints: z.union([z.string().max(500), z.literal(''), z.null()]).optional(),
  declined: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const profile = await prisma.planningProfile.findUnique({ where: { userId } })
    return NextResponse.json(profile || null)
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json({ error: (error as Error)?.message }, { status: statusCode })
    }
    console.error('Planning profile GET error:', error)
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const validation = PlanningProfileSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { hoursPerWeek, experienceLevel, hasBudget, currentWorkload, constraints, declined } = validation.data

    const data: Record<string, unknown> = {}
    if (hoursPerWeek != null) data.hoursPerWeek = Number(hoursPerWeek)
    if (experienceLevel !== undefined) data.experienceLevel = experienceLevel || null
    if (hasBudget !== undefined) data.hasBudget = hasBudget || null
    if (currentWorkload !== undefined) data.currentWorkload = currentWorkload || null
    if (constraints !== undefined) data.constraints = constraints ? String(constraints).slice(0, 500) : null
    if (declined === true) data.declined = true
    if (declined === false) data.declined = false

    const profile = await prisma.planningProfile.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data,
      },
    })

    return NextResponse.json(profile)
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json({ error: (error as Error)?.message }, { status: statusCode })
    }
    console.error('Planning profile POST error:', error)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }
}
