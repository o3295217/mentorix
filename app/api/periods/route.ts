import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    
    const evaluations = await prisma.periodEvaluation.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(evaluations)
  } catch (error) {
    const statusCode = (error as any)?.statusCode
    if (typeof statusCode === 'number') {
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Error fetching period evaluations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch period evaluations' },
      { status: 500 }
    )
  }
}
