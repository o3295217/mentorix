import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const dream = await prisma.dreamGoal.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(dream || null)
  } catch (error) {
    console.error('Error fetching dream goal:', error)
    return NextResponse.json({ error: 'Failed to fetch dream goal' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { goalText, years } = body

    if (!goalText) {
      return NextResponse.json({ error: 'goalText is required' }, { status: 400 })
    }

    const yearsValue = years && years >= 1 && years <= 10 ? years : 5

    // Create or update dream goal (we only keep one)
    const dream = await prisma.dreamGoal.create({
      data: {
        goalText,
        years: yearsValue,
      },
    })

    return NextResponse.json(dream)
  } catch (error) {
    console.error('Error creating dream goal:', error)
    return NextResponse.json({ error: 'Failed to create dream goal' }, { status: 500 })
  }
}
