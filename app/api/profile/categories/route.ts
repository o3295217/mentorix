import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'

// GET /api/profile/categories?blockId=123 - получить категории блока
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const searchParams = request.nextUrl.searchParams
    const blockId = searchParams.get('blockId')

    if (!blockId) {
      return NextResponse.json({ error: 'Block ID is required' }, { status: 400 })
    }

    // Проверяем что блок принадлежит пользователю
    const block = await prisma.profileBlock.findFirst({
      where: { id: parseInt(blockId), userId }
    })
    if (!block) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    }

    const categories = await prisma.profileCategory.findMany({
      where: { blockId: parseInt(blockId) },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

// POST /api/profile/categories - создать новую категорию
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    const { blockId, title } = body

    if (!blockId || !title || typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json({ error: 'Block ID and title are required' }, { status: 400 })
    }

    // Проверяем что блок принадлежит пользователю
    const block = await prisma.profileBlock.findFirst({
      where: { id: parseInt(blockId), userId }
    })
    if (!block) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    }

    // Получаем максимальный order для новой категории
    const maxOrder = await prisma.profileCategory.aggregate({
      where: { blockId: parseInt(blockId) },
      _max: { order: true },
    })

    const category = await prisma.profileCategory.create({
      data: {
        blockId: parseInt(blockId),
        title: title.trim(),
        order: (maxOrder._max.order || 0) + 1,
      },
      include: {
        items: true,
      },
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}

// DELETE /api/profile/categories?id=123 - удалить категорию
export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    const numericId = parseInt(id)
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 })
    }

    // Проверяем что категория принадлежит блоку пользователя
    const category = await prisma.profileCategory.findFirst({
      where: { id: numericId },
      include: { block: true }
    })
    if (!category || category.block.userId !== userId) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    await prisma.profileCategory.delete({
      where: { id: numericId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}

// PATCH /api/profile/categories - обновить категорию
export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    const { id, title, order } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const numericId = typeof id === 'number' ? id : parseInt(id)
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    // Проверяем что категория принадлежит блоку пользователя
    const existingCategory = await prisma.profileCategory.findFirst({
      where: { id: numericId },
      include: { block: true }
    })
    if (!existingCategory || existingCategory.block.userId !== userId) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const updateData: { title?: string; order?: number } = {}
    if (title !== undefined) updateData.title = title.trim()
    if (order !== undefined) updateData.order = parseInt(order)

    const category = await prisma.profileCategory.update({
      where: { id: numericId },
      data: updateData,
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}
