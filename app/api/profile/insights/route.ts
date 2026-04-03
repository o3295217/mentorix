import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId } from '@/lib/get-user-id';
import { z } from 'zod'

const InsightsSchema = z.object({
  patterns: z.string().max(5000).nullable().optional(),
  strengths: z.string().max(5000).nullable().optional(),
  challenges: z.string().max(5000).nullable().optional(),
  preferences: z.string().max(5000).nullable().optional(),
  recommendations: z.string().max(5000).nullable().optional(),
  motivators: z.string().max(5000).nullable().optional(),
  weeklySummary: z.string().max(5000).nullable().optional(),
  evaluationCount: z.number().int().min(0).max(100000).optional(),
})

// GET - получить профиль пользователя
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request);
    
    // Берём запись пользователя или создаём пустую
    let insights = await prisma.userInsights.findFirst({
      where: { userId }
    });
    
    if (!insights) {
      insights = await prisma.userInsights.create({
        data: { userId }
      });
    }
    
    return NextResponse.json(insights);
  } catch (error) {
    console.error('Error fetching user insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}

// PUT - обновить профиль пользователя
export async function PUT(request: NextRequest) {
  try {
    const userId = await requireUserId(request);
    const validation = InsightsSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const data = validation.data
    
    // Находим существующую запись или создаём
    let insights = await prisma.userInsights.findFirst({
      where: { userId }
    });
    
    if (!insights) {
      insights = await prisma.userInsights.create({
        data: {
          userId,
          patterns: data.patterns,
          strengths: data.strengths,
          challenges: data.challenges,
          preferences: data.preferences,
          recommendations: data.recommendations,
          motivators: data.motivators,
          weeklySummary: data.weeklySummary,
          evaluationCount: data.evaluationCount || 0
        }
      });
    } else {
      insights = await prisma.userInsights.update({
        where: { id: insights.id },
        data: {
          patterns: data.patterns !== undefined ? data.patterns : insights.patterns,
          strengths: data.strengths !== undefined ? data.strengths : insights.strengths,
          challenges: data.challenges !== undefined ? data.challenges : insights.challenges,
          preferences: data.preferences !== undefined ? data.preferences : insights.preferences,
          recommendations: data.recommendations !== undefined ? data.recommendations : insights.recommendations,
          motivators: data.motivators !== undefined ? data.motivators : insights.motivators,
          weeklySummary: data.weeklySummary !== undefined ? data.weeklySummary : insights.weeklySummary,
          evaluationCount: data.evaluationCount !== undefined ? data.evaluationCount : insights.evaluationCount
        }
      });
    }
    
    return NextResponse.json(insights);
  } catch (error) {
    console.error('Error updating user insights:', error);
    return NextResponse.json(
      { error: 'Failed to update insights' },
      { status: 500 }
    );
  }
}
