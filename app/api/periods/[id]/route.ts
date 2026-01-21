import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId(request)
    const { id } = await params
    const numericId = parseInt(id)
    
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid period ID' }, { status: 400 })
    }
    
    const evaluation = await prisma.periodEvaluation.findFirst({
      where: { 
        id: numericId,
        userId,  // Проверка владельца
      },
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
