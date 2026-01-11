import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'

// POST /api/profile/items - создать новый пункт в блоке или категории
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    const { blockId, categoryId, fieldName, fieldValue } = body

    if ((!blockId && !categoryId) || !fieldName || !fieldValue) {
      return NextResponse.json({ error: 'Block ID or Category ID, field name and field value are required' }, { status: 400 })
    }

    // Проверяем принадлежность блока пользователю
    if (blockId) {
      const block = await prisma.profileBlock.findFirst({
        where: { id: parseInt(blockId), userId }
      })
      if (!block) {
        return NextResponse.json({ error: 'Block not found' }, { status: 404 })
      }
    }

    // Проверяем принадлежность категории через блок
    if (categoryId) {
      const category = await prisma.profileCategory.findFirst({
        where: { id: parseInt(categoryId) },
        include: { block: true }
      })
      if (!category || category.block.userId !== userId) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 })
      }
    }

    // Получаем максимальный order для нового пункта
    const whereClause = categoryId
      ? { categoryId: parseInt(categoryId) }
      : { blockId: parseInt(blockId), categoryId: null }

    const maxOrder = await prisma.profileItem.aggregate({
      where: whereClause,
      _max: { order: true },
    })

    const item = await prisma.profileItem.create({
      data: {
        blockId: blockId ? parseInt(blockId) : null,
        categoryId: categoryId ? parseInt(categoryId) : null,
        fieldName: fieldName.trim(),
        fieldValue: fieldValue.trim(),
        content: null, // Deprecated field for backward compatibility
        order: (maxOrder._max.order || 0) + 1,
      },
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error creating profile item:', error)
    return NextResponse.json({ error: 'Failed to create profile item' }, { status: 500 })
  }
}

// Вспомогательная функция проверки принадлежности item пользователю
async function verifyItemOwnership(itemId: number, userId: string): Promise<boolean> {
  const item = await prisma.profileItem.findFirst({
    where: { id: itemId },
    include: { 
      block: true,
      category: { include: { block: true } }
    }
  })
  if (!item) return false
  
  // Проверяем через блок напрямую или через категорию
  if (item.block && item.block.userId === userId) return true
  if (item.category && item.category.block.userId === userId) return true
  
  return false
}

// DELETE /api/profile/items?id=123 - удалить пункт
export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    const numericId = parseInt(id)
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 })
    }

    if (!await verifyItemOwnership(numericId, userId)) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    await prisma.profileItem.delete({
      where: { id: numericId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting profile item:', error)
    return NextResponse.json({ error: 'Failed to delete profile item' }, { status: 500 })
  }
}

// PATCH /api/profile/items - обновить содержимое пункта
export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    const { id, fieldName, fieldValue, order } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const numericId = typeof id === 'number' ? id : parseInt(id)
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    if (!await verifyItemOwnership(numericId, userId)) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const updateData: { fieldName?: string; fieldValue?: string; order?: number } = {}
    if (fieldName !== undefined) updateData.fieldName = fieldName.trim()
    if (fieldValue !== undefined) updateData.fieldValue = fieldValue.trim()
    if (order !== undefined) updateData.order = parseInt(order)

    const item = await prisma.profileItem.update({
      where: { id: numericId },
      data: updateData,
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error updating profile item:', error)
    return NextResponse.json({ error: 'Failed to update profile item' }, { status: 500 })
  }
}
