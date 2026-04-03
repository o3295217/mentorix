import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'
import { z } from 'zod'

const ProfileItemCreateSchema = z.object({
  blockId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  fieldName: z.string().trim().min(1).max(120),
  fieldValue: z.string().trim().min(1).max(4000),
}).refine((data) => data.blockId || data.categoryId, {
  message: 'Block ID or Category ID is required',
  path: ['blockId'],
})

const ProfileItemUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  fieldName: z.string().trim().min(1).max(120).optional(),
  fieldValue: z.string().trim().min(1).max(4000).optional(),
  order: z.coerce.number().int().min(0).max(100000).optional(),
})

// POST /api/profile/items - создать новый пункт в блоке или категории
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const validation = ProfileItemCreateSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { blockId, categoryId, fieldName, fieldValue } = validation.data

    // Проверяем принадлежность блока пользователю
    if (blockId) {
      const block = await prisma.profileBlock.findFirst({
        where: { id: blockId, userId }
      })
      if (!block) {
        return NextResponse.json({ error: 'Block not found' }, { status: 404 })
      }
    }

    // Проверяем принадлежность категории через блок
    if (categoryId) {
      const category = await prisma.profileCategory.findFirst({
        where: { id: categoryId },
        include: { block: true }
      })
      if (!category || category.block.userId !== userId) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 })
      }
    }

    // Получаем максимальный order для нового пункта
    const whereClause = categoryId
      ? { categoryId }
      : { blockId, categoryId: null }

    const maxOrder = await prisma.profileItem.aggregate({
      where: whereClause,
      _max: { order: true },
    })

    const item = await prisma.profileItem.create({
      data: {
        blockId: blockId ?? null,
        categoryId: categoryId ?? null,
        fieldName,
        fieldValue,
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
    const validation = ProfileItemUpdateSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { id: numericId, fieldName, fieldValue, order } = validation.data

    if (!await verifyItemOwnership(numericId, userId)) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const updateData: { fieldName?: string; fieldValue?: string; order?: number } = {}
    if (fieldName !== undefined) updateData.fieldName = fieldName
    if (fieldValue !== undefined) updateData.fieldValue = fieldValue
    if (order !== undefined) updateData.order = order

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
