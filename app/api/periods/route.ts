import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const evaluations = await prisma.periodEvaluation.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(evaluations)
  } catch (error) {
    console.error('Error fetching period evaluations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch period evaluations' },
      { status: 500 }
    )
  }
}
