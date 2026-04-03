import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'
import { z } from 'zod'

const ProfileBlockCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
})

const ProfileBlockUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(120).optional(),
  order: z.coerce.number().int().min(0).max(100000).optional(),
})

// GET /api/profile/blocks - получить все блоки с категориями и пунктами
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const blocks = await prisma.profileBlock.findMany({
      where: { userId },
      include: {
        categories: {
          include: {
            items: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
        items: {
          where: { categoryId: null }, // Только items без категории
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(blocks)
  } catch (error) {
    console.error('Error fetching profile blocks:', error)
    return NextResponse.json({ error: 'Failed to fetch profile blocks' }, { status: 500 })
  }
}

// POST /api/profile/blocks - создать новый блок
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const validation = ProfileBlockCreateSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { title } = validation.data

    // Получаем максимальный order для нового блока
    const maxOrder = await prisma.profileBlock.aggregate({
      where: { userId },
      _max: { order: true },
    })

    const block = await prisma.profileBlock.create({
      data: {
        userId,
        title: title.trim(),
        order: (maxOrder._max.order || 0) + 1,
      },
      include: {
        items: true,
      },
    })

    return NextResponse.json(block)
  } catch (error) {
    console.error('Error creating profile block:', error)
    return NextResponse.json({ error: 'Failed to create profile block' }, { status: 500 })
  }
}

// DELETE /api/profile/blocks?id=123 - удалить блок
export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Block ID is required' }, { status: 400 })
    }

    const numericId = parseInt(id)
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid block ID' }, { status: 400 })
    }

    await prisma.profileBlock.delete({
      where: { id: numericId, userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting profile block:', error)
    return NextResponse.json({ error: 'Failed to delete profile block' }, { status: 500 })
  }
}

// PATCH /api/profile/blocks - обновить название или порядок блока
export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const validation = ProfileBlockUpdateSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { id: numericId, title, order } = validation.data

    const updateData: { title?: string; order?: number } = {}
    if (title !== undefined) updateData.title = title
    if (order !== undefined) updateData.order = order

    const block = await prisma.profileBlock.update({
      where: { id: numericId, userId },
      data: updateData,
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json(block)
  } catch (error) {
    console.error('Error updating profile block:', error)
    return NextResponse.json({ error: 'Failed to update profile block' }, { status: 500 })
  }
}
