/**
 * AI Usage Tracking
 * Логирование и статистика использования AI API
 * 
 * NOTE: Модель AIUsage была временно удалена из схемы Prisma.
 * Функции сохранены, но не записывают данные в БД.
 */

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
 * NOTE: AIUsage модель была удалена из схемы. Функция временно отключена.
 */
export async function logAIUsage(data: AIUsageData): Promise<void> {
  // TODO: Восстановить логирование после добавления модели AIUsage в схему
  // Пока просто логируем в консоль для отладки
  console.log(`[AI Usage] ${data.endpoint}: ${data.inputTokens}+${data.outputTokens} tokens (${data.model})`)
}

/**
 * Получить статистику использования AI для пользователя
 * NOTE: AIUsage модель была удалена из схемы. Функция временно отключена.
 */
export async function getUserAIStats(userId: string, days: number = 30) {
  // TODO: Восстановить после добавления модели AIUsage в схему
  return {
    period: `${days} days`,
    totals: { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, costCents: 0 },
    byEndpoint: {},
    byDay: {},
    recentUsage: [],
  }
}

/**
 * Получить общую статистику использования AI (для админа)
 * NOTE: AIUsage модель была удалена из схемы. Функция временно отключена.
 */
export async function getGlobalAIStats(days: number = 30) {
  // TODO: Восстановить после добавления модели AIUsage в схему
  return {
    period: `${days} days`,
    totals: { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, costCents: 0 },
    costDollars: '0.00',
    byUser: [],
    byEndpoint: {},
    totalUsers: 0,
  }
}
