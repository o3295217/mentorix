import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'

// GET - получить все теги
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const tags = await prisma.goalTag.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(tags)
  } catch (error) {
    console.error('Error fetching tags:', error)
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
  }
}

// POST - создать новый тег
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    const { name, color } = body

    const tag = await prisma.goalTag.create({
      data: {
        userId,
        name,
        color: color || '#6B7280',
      },
    })

    return NextResponse.json(tag)
  } catch (error) {
    console.error('Error creating tag:', error)
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}

// DELETE - удалить тег
export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const numericId = parseInt(id)
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid tag ID' }, { status: 400 })
    }

    await prisma.goalTag.delete({ where: { id: numericId, userId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tag:', error)
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 })
  }
}
