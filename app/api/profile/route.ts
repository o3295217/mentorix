import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'

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
    const statusCode = (error as any)?.statusCode
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
    const body = await request.json()

    const {
      name,
      occupation,
      industry,
      maritalStatus,
      hobbies,
      sports,
      location,
      age,
      education,
      teamSize,
      workExperience,
      values,
      challenges,
      other,
    } = body

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
        data: {
          name,
          occupation,
          industry,
          maritalStatus,
          hobbies,
          sports,
          location,
          age,
          education,
          teamSize,
          workExperience,
          values,
          challenges,
          other,
        },
      })
    } else {
      // Создаем новый профиль
      profile = await prisma.userProfile.create({
        data: {
          userId,
          name,
          occupation,
          industry,
          maritalStatus,
          hobbies,
          sports,
          location,
          age,
          education,
          teamSize,
          workExperience,
          values,
          challenges,
          other,
        },
      })
    }

    return NextResponse.json(profile)
  } catch (error) {
    const statusCode = (error as any)?.statusCode
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
