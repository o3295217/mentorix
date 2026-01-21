/**
 * AI Usage Tracking
 * Логирование и статистика использования AI API
 */

import { prisma } from './prisma'

// Цены Anthropic (за 1M токенов)
const PRICING = {
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
  // Fallback
  'default': { input: 3.00, output: 15.00 },
} as const

type ModelName = keyof typeof PRICING

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model as ModelName] || PRICING['default']
  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return (inputCost + outputCost) * 100 // в центах
}

export interface AIUsageData {
  userId: string
  endpoint: string
  model: string
  inputTokens: number
  outputTokens: number
  durationMs?: number
  success?: boolean
  errorMessage?: string
}

/**
 * Логирует использование AI API
 */
export async function logAIUsage(data: AIUsageData): Promise<void> {
  try {
    const totalTokens = data.inputTokens + data.outputTokens
    const costCents = calculateCost(data.model, data.inputTokens, data.outputTokens)

    await prisma.aIUsage.create({
      data: {
        userId: data.userId,
        endpoint: data.endpoint,
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens,
        costCents,
        durationMs: data.durationMs,
        success: data.success ?? true,
        errorMessage: data.errorMessage,
      },
    })
  } catch (error) {
    // Логирование не должно ломать основной запрос
    console.error('Failed to log AI usage:', error)
  }
}

/**
 * Получить статистику использования AI для пользователя
 */
export async function getUserAIStats(userId: string, days: number = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const usage = await prisma.aIUsage.findMany({
    where: {
      userId,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
  })

  const totals = usage.reduce(
    (acc, u) => ({
      requests: acc.requests + 1,
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
      totalTokens: acc.totalTokens + u.totalTokens,
      costCents: acc.costCents + u.costCents,
    }),
    { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, costCents: 0 }
  )

  // Группировка по endpoint
  const byEndpoint = usage.reduce((acc, u) => {
    acc[u.endpoint] = (acc[u.endpoint] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Группировка по дням
  const byDay = usage.reduce((acc, u) => {
    const day = u.createdAt.toISOString().split('T')[0]
    acc[day] = (acc[day] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    period: `${days} days`,
    totals,
    byEndpoint,
    byDay,
    recentUsage: usage.slice(0, 10),
  }
}

/**
 * Получить общую статистику использования AI (для админа)
 */
export async function getGlobalAIStats(days: number = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const usage = await prisma.aIUsage.findMany({
    where: {
      createdAt: { gte: since },
    },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Totals
  const totals = usage.reduce(
    (acc, u) => ({
      requests: acc.requests + 1,
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
      totalTokens: acc.totalTokens + u.totalTokens,
      costCents: acc.costCents + u.costCents,
    }),
    { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, costCents: 0 }
  )

  // По пользователям
  const byUser = usage.reduce((acc, u) => {
    const key = u.userId
    if (!acc[key]) {
      acc[key] = {
        user: u.user,
        requests: 0,
        totalTokens: 0,
        costCents: 0,
      }
    }
    acc[key].requests++
    acc[key].totalTokens += u.totalTokens
    acc[key].costCents += u.costCents
    return acc
  }, {} as Record<string, { user: { id: string; email: string; name: string | null }; requests: number; totalTokens: number; costCents: number }>)

  // По endpoint
  const byEndpoint = usage.reduce((acc, u) => {
    acc[u.endpoint] = (acc[u.endpoint] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    period: `${days} days`,
    totals,
    costDollars: (totals.costCents / 100).toFixed(2),
    byUser: Object.values(byUser).sort((a, b) => b.costCents - a.costCents),
    byEndpoint,
    totalUsers: Object.keys(byUser).length,
  }
}
