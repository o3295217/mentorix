import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/profile/items - создать новый пункт в блоке или категории
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { blockId, categoryId, fieldName, fieldValue } = body

    if ((!blockId && !categoryId) || !fieldName || !fieldValue) {
      return NextResponse.json({ error: 'Block ID or Category ID, field name and field value are required' }, { status: 400 })
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

// DELETE /api/profile/items?id=123 - удалить пункт
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    const numericId = parseInt(id)
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 })
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
    const body = await request.json()
    const { id, fieldName, fieldValue, order } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const numericId = typeof id === 'number' ? id : parseInt(id)
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
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
