/**
 * Тарифы Anthropic API (USD за 1M токенов: input/output)
 * https://www.anthropic.com/pricing
 */
const PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  'claude-opus-4-8': { input: 15, output: 75 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 }, // устаревший снапшот, тариф как у sonnet
  'claude-haiku-4-5': { input: 1, output: 5 },
}

// Если модель не найдена в таблице — считаем по тарифу Sonnet (самая частая модель в проекте)
const FALLBACK_PRICING = PRICING_PER_MILLION_TOKENS['claude-sonnet-4-6']

function resolvePricing(model: string): { input: number; output: number } {
  if (PRICING_PER_MILLION_TOKENS[model]) return PRICING_PER_MILLION_TOKENS[model]

  // Совпадение по префиксу семейства модели (на случай новых дата-снапшотов)
  const family = Object.keys(PRICING_PER_MILLION_TOKENS).find((key) => model.startsWith(key.split('-').slice(0, 3).join('-')))
  return family ? PRICING_PER_MILLION_TOKENS[family] : FALLBACK_PRICING
}

/**
 * Считает стоимость запроса в центах (целое число, округление вверх до цента)
 */
export function calculateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = resolvePricing(model)
  const dollars =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  return Math.ceil(dollars * 100)
}
