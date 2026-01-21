import { NextRequest, NextResponse } from 'next/server'
import { requireUserId } from '@/lib/get-user-id'
import { getUserAIStats, getGlobalAIStats } from '@/lib/ai-usage'
import { getAuthUser } from '@/lib/auth'

/**
 * GET /api/analytics/ai-usage
 * Получить статистику использования AI
 * 
 * Query params:
 * - days: количество дней (по умолчанию 30)
 * - global: true для админской статистики по всем пользователям
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30')
    const global = searchParams.get('global') === 'true'

    // Глобальная статистика только для админов
    if (global) {
      const user = await getAuthUser(request)
      if (user?.role !== 'admin') {
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        )
      }
      
      const stats = await getGlobalAIStats(days)
      return NextResponse.json(stats)
    }

    // Статистика пользователя
    const stats = await getUserAIStats(userId, days)
    return NextResponse.json(stats)

  } catch (error) {
    console.error('Error fetching AI usage stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI usage statistics' },
      { status: 500 }
    )
  }
}
