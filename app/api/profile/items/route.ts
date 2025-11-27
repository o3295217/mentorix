import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/profile/items - создать новый пункт в блоке или категории
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('📥 POST /api/profile/items - body:', body)
    const { blockId, categoryId, fieldName, fieldValue } = body

    if ((!blockId && !categoryId) || !fieldName || !fieldValue) {
      console.log('❌ Validation failed:', { blockId, categoryId, fieldName, fieldValue })
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

    console.log('✅ Item created:', item)
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

    await prisma.profileItem.delete({
      where: { id: parseInt(id) },
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

    const updateData: any = {}
    if (fieldName !== undefined) updateData.fieldName = fieldName.trim()
    if (fieldValue !== undefined) updateData.fieldValue = fieldValue.trim()
    if (order !== undefined) updateData.order = parseInt(order)

    const item = await prisma.profileItem.update({
      where: { id: parseInt(id) },
      data: updateData,
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error updating profile item:', error)
    return NextResponse.json({ error: 'Failed to update profile item' }, { status: 500 })
  }
}
