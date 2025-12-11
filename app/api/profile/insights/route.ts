import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - получить профиль пользователя
export async function GET() {
  try {
    // Берём первую (и единственную) запись или создаём пустую
    let insights = await prisma.userInsights.findFirst();
    
    if (!insights) {
      insights = await prisma.userInsights.create({
        data: {}
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
export async function PUT(request: Request) {
  try {
    const data = await request.json();
    
    // Находим существующую запись или создаём
    let insights = await prisma.userInsights.findFirst();
    
    if (!insights) {
      insights = await prisma.userInsights.create({
        data: {
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
