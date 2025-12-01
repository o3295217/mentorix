import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const tasks = await prisma.openTask.findMany({
      where: { isClosed: true },
      orderBy: { closedAt: 'desc' },
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Error fetching closed tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch closed tasks' }, { status: 500 })
  }
}
