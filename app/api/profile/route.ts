import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'
import { z } from 'zod'

const UserProfileSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  occupation: z.string().max(150).nullable().optional(),
  industry: z.string().max(150).nullable().optional(),
  maritalStatus: z.string().max(80).nullable().optional(),
  hobbies: z.string().max(2000).nullable().optional(),
  sports: z.string().max(2000).nullable().optional(),
  location: z.string().max(150).nullable().optional(),
  age: z.number().int().min(0).max(120).nullable().optional(),
  education: z.string().max(150).nullable().optional(),
  teamSize: z.number().int().min(0).max(100000).nullable().optional(),
  workExperience: z.string().max(120).nullable().optional(),
  values: z.string().max(2000).nullable().optional(),
  challenges: z.string().max(2000).nullable().optional(),
  other: z.string().max(2000).nullable().optional(),
})

// GET /api/profile - получить профиль пользователя
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const profile = await prisma.userProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    if (!profile) {
      return NextResponse.json(null)
    }

    return NextResponse.json(profile)
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error fetching profile:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

// POST /api/profile - создать или обновить профиль
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const validation = UserProfileSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const data = validation.data

    // Проверяем, есть ли уже профиль
    const existingProfile = await prisma.userProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    let profile

    if (existingProfile) {
      // Обновляем существующий профиль
      profile = await prisma.userProfile.update({
        where: { id: existingProfile.id },
        data,
      })
    } else {
      // Создаем новый профиль
      profile = await prisma.userProfile.create({
        data: {
          userId,
          ...data,
        },
      })
    }

    return NextResponse.json(profile)
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error saving profile:', error)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }
}
