import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const tasks = await prisma.openTask.findMany({
      where: { userId, isClosed: true },
      orderBy: { closedAt: 'desc' },
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Error fetching closed tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch closed tasks' }, { status: 500 })
  }
}
