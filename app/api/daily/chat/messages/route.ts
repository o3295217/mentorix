import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'

const ALLOWED_CHAT_ROLES = new Set(['user', 'assistant'])

// GET - получить историю сообщений за день
export async function GET(request: NextRequest) {
  const userId = await requireUserId(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  
  if (!date) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 })
  }

  try {
    const messages = await prisma.chatMessage.findMany({
      where: { userId, date },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Error fetching chat messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

// POST - сохранить сообщение (user или assistant)
export async function POST(request: NextRequest) {
  const userId = await requireUserId(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { date, role, content } = await request.json()

    if (typeof date !== 'string' || typeof role !== 'string' || typeof content !== 'string' || !date || !role || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!ALLOWED_CHAT_ROLES.has(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const message = await prisma.chatMessage.create({
      data: {
        userId,
        date,
        role,
        content,
      },
    })

    return NextResponse.json({ message })
  } catch (error) {
    console.error('Error saving chat message:', error)
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }
}

// DELETE - очистить историю за день
export async function DELETE(request: NextRequest) {
  const userId = await requireUserId(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  
  if (!date) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 })
  }

  try {
    await prisma.chatMessage.deleteMany({
      where: { userId, date },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting chat messages:', error)
    return NextResponse.json({ error: 'Failed to delete messages' }, { status: 500 })
  }
}
