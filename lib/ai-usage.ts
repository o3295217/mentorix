/**
 * AI Usage Tracking
 * Логирование использования AI API
 */

import { prisma } from '@/lib/prisma'
import { calculateCostCents } from '@/lib/ai-pricing'

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
 * Логирует использование AI API. Стоимость считается по тарифу модели
 * на момент запроса и сохраняется вместе с записью (не пересчитывается задним числом).
 */
export async function logAIUsage(data: AIUsageData): Promise<void> {
  try {
    await prisma.aIUsage.create({
      data: {
        userId: data.userId,
        endpoint: data.endpoint,
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        costCents: calculateCostCents(data.model, data.inputTokens, data.outputTokens),
        durationMs: data.durationMs ?? null,
        success: data.success ?? true,
        errorMessage: data.errorMessage ?? null,
      },
    })
  } catch (e) {
    console.error('[AI Usage] Failed to log:', e)
  }
}

/**
 * Получить статистику использования AI для пользователя
 */
export async function getUserAIStats(userId: string, days: number = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const records = await prisma.aIUsage.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
  })

  const totals = { requests: records.length, inputTokens: 0, outputTokens: 0, totalTokens: 0, costCents: 0 }
  const byEndpoint: Record<string, { requests: number; tokens: number; costCents: number }> = {}
  const byDay: Record<string, { requests: number; tokens: number; costCents: number }> = {}

  for (const r of records) {
    totals.inputTokens += r.inputTokens
    totals.outputTokens += r.outputTokens
    totals.costCents += r.costCents

    const ep = byEndpoint[r.endpoint] ??= { requests: 0, tokens: 0, costCents: 0 }
    ep.requests++
    ep.tokens += r.inputTokens + r.outputTokens
    ep.costCents += r.costCents

    const day = r.createdAt.toISOString().slice(0, 10)
    const d = byDay[day] ??= { requests: 0, tokens: 0, costCents: 0 }
    d.requests++
    d.tokens += r.inputTokens + r.outputTokens
    d.costCents += r.costCents
  }

  totals.totalTokens = totals.inputTokens + totals.outputTokens

  return {
    period: `${days} days`,
    totals,
    costDollars: (totals.costCents / 100).toFixed(2),
    byEndpoint,
    byDay,
    recentUsage: records.slice(0, 20).map(r => ({
      endpoint: r.endpoint,
      model: r.model,
      tokens: r.inputTokens + r.outputTokens,
      costDollars: (r.costCents / 100).toFixed(2),
      success: r.success,
      createdAt: r.createdAt,
    })),
  }
}

/**
 * Получить общую статистику использования AI (для админа)
 */
export async function getGlobalAIStats(days: number = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const records = await prisma.aIUsage.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
  })

  const totals = { requests: records.length, inputTokens: 0, outputTokens: 0, totalTokens: 0, costCents: 0 }
  const byEndpoint: Record<string, { requests: number; tokens: number; costCents: number }> = {}
  const byUser: Record<string, { requests: number; tokens: number; costCents: number }> = {}

  for (const r of records) {
    totals.inputTokens += r.inputTokens
    totals.outputTokens += r.outputTokens
    totals.costCents += r.costCents

    const ep = byEndpoint[r.endpoint] ??= { requests: 0, tokens: 0, costCents: 0 }
    ep.requests++
    ep.tokens += r.inputTokens + r.outputTokens
    ep.costCents += r.costCents

    const u = byUser[r.userId] ??= { requests: 0, tokens: 0, costCents: 0 }
    u.requests++
    u.tokens += r.inputTokens + r.outputTokens
    u.costCents += r.costCents
  }

  totals.totalTokens = totals.inputTokens + totals.outputTokens

  return {
    period: `${days} days`,
    totals,
    costDollars: (totals.costCents / 100).toFixed(2),
    byUser: Object.entries(byUser).map(([userId, data]) => ({
      userId,
      requests: data.requests,
      tokens: data.tokens,
      costDollars: (data.costCents / 100).toFixed(2),
    })),
    byEndpoint: Object.fromEntries(
      Object.entries(byEndpoint).map(([endpoint, data]) => [
        endpoint,
        { requests: data.requests, tokens: data.tokens, costDollars: (data.costCents / 100).toFixed(2) },
      ])
    ),
    totalUsers: Object.keys(byUser).length,
  }
}
