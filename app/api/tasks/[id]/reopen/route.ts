import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const numericId = parseInt(id)
    
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    const task = await prisma.openTask.update({
      where: { id: numericId },
      data: {
        isClosed: false,
        closedAt: null,
      },
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error reopening task:', error)
    return NextResponse.json({ error: 'Failed to reopen task' }, { status: 500 })
  }
}
