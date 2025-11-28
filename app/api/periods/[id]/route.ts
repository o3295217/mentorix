import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const evaluation = await prisma.periodEvaluation.findUnique({
      where: { id: parseInt(id) },
    })

    if (!evaluation) {
      return NextResponse.json(
        { error: 'Period evaluation not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(evaluation)
  } catch (error) {
    console.error('Error fetching period evaluation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch period evaluation' },
      { status: 500 }
    )
  }
}
