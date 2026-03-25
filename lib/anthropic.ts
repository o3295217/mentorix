import Anthropic from '@anthropic-ai/sdk'
import {
  DailyEvaluationRequest,
  DailyEvaluationResponse,
  PeriodEvaluationRequest,
  PeriodEvaluationResponse,
  ForecastRequest,
  ForecastResponse,
  UserProfile,
  GoalsHierarchy,
  DailyContext,
} from './prompts/types'
import { DAILY_EVALUATION_SYSTEM_PROMPT, buildUserDataPrompt, validateGoals } from './prompts/daily'
import { buildPeriodEvaluationPrompt } from './prompts/period'
import { buildForecastPrompt } from './prompts/forecast'
import { extractJsonFromAIResponse, isValidScore, clampScore, sanitizeUserInput } from './api-utils'
import { notifyTelegram } from './telegram'

// ============================================================================
// API KEY VALIDATION (Lazy initialization for build-time compatibility)
// ============================================================================

let _anthropic: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable is not set. ' +
        'Please set it in your .env.local file or environment.'
      )
    }
    
    // Если задан ANTHROPIC_PROXY_URL — используем Cloudflare Worker прокси
    // для обхода гео-блокировки Anthropic API
    const proxyUrl = process.env.ANTHROPIC_PROXY_URL
    const proxySecret = process.env.ANTHROPIC_PROXY_SECRET
    
    _anthropic = new Anthropic({
      apiKey,
      maxRetries: 2,
      timeout: 5 * 60 * 1000, // 5 minutes timeout for the HTTP client
      ...(proxyUrl ? { baseURL: proxyUrl } : {}),
      ...(proxyUrl && proxySecret ? { defaultHeaders: { 'x-proxy-secret': proxySecret } } : {}),
    })
  }
  return _anthropic
}

// ============================================================================
// RETRY LOGIC WITH EXPONENTIAL BACKOFF
// ============================================================================

interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
}

class AIServiceError extends Error {
  constructor(
    message: string,
    public code: 'RATE_LIMIT' | 'API_ERROR' | 'PARSE_ERROR' | 'VALIDATION_ERROR',
    public retryable: boolean = false,
    public originalError?: unknown
  ) {
    super(message)
    this.name = 'AIServiceError'
  }
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30000 } = options
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if error is retryable
      const isRateLimitError =
        error instanceof Error &&
        ('status' in error && (error as { status: number }).status === 429)

      const isServerError =
        error instanceof Error &&
        ('status' in error && (error as { status: number }).status >= 500)

      const isNetworkError =
        error instanceof Error &&
        (error.message.includes('ECONNREFUSED') ||
         error.message.includes('ETIMEDOUT') ||
         error.message.includes('network'))

      const shouldRetry = isRateLimitError || isServerError || isNetworkError

      if (!shouldRetry || attempt === maxRetries) {
        // Telegram notification on final failure
        const status = 'status' in (error as object) ? (error as { status: number }).status : 'N/A';
        const errMsg = error instanceof Error ? error.message : String(error);
        const shortMsg = errMsg.length > 200 ? errMsg.slice(0, 200) + '...' : errMsg;
        notifyTelegram(
          `🔴 <b>Anthropic API Error</b>\nStatus: ${status}\n${shortMsg}\nRetries: ${attempt}/${maxRetries}`,
          `anthropic-${isRateLimitError ? '429' : isServerError ? '5xx' : 'network'}`
        );

        if (isRateLimitError) {
          throw new AIServiceError(
            'Rate limit exceeded. Please try again later.',
            'RATE_LIMIT',
            true,
            error
          )
        }
        throw error
      }

      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt)
      const jitter = Math.random() * 1000
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs)

      console.warn(
        `[Claude API] Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`,
        { error: lastError.message }
      )

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

// Логирование статистики кэширования Claude API
interface CacheUsage {
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
  input_tokens?: number
  output_tokens?: number
}

function logCacheStats(functionName: string, usage: CacheUsage | undefined) {
  const cacheCreated = usage?.cache_creation_input_tokens || 0
  const cacheRead = usage?.cache_read_input_tokens || 0
  const inputTokens = usage?.input_tokens || 0
  const outputTokens = usage?.output_tokens || 0
  
  const cacheHit = cacheRead > 0
  const savingsPercent = inputTokens > 0 ? Math.round((cacheRead / (inputTokens + cacheRead)) * 100) : 0
  
  console.log(`[Claude Cache] ${functionName}:`, {
    cacheHit,
    cacheCreated,
    cacheRead,
    inputTokens,
    outputTokens,
    savingsPercent: `${savingsPercent}%`,
  })
}

// Экспорт типов для обратной совместимости
export type { UserProfile, GoalsHierarchy, DailyContext, DailyEvaluationResponse }

// Старый интерфейс для обратной совместимости (deprecated)
export interface EvaluationRequest {
  dreamGoal: string
  yearGoals: string[]
  halfYearGoals: string[]
  quarterGoals: string[]
  monthGoals: string[]
  weekGoals: string[]
  planText: string
  factText: string
  date: string
  openTasks: string[]
  userProfile?: UserProfile
}

// Старый интерфейс ответа (deprecated)
export interface EvaluationResponse {
  strategic_focus_score: number
  productivity_score: number
  life_balance_score: number
  discipline_score: number
  overall_score: number
  plan_vs_fact: string
  feedback: string
  alignment: {
    day_to_week: string
    week_to_month: string
    month_to_quarter: string
    quarter_to_half: string
    half_to_year: string
    year_to_dream: string
  }
  recommendations: string
}

// Конвертация старого формата в новый
function convertLegacyRequest(legacy: EvaluationRequest): DailyEvaluationRequest {
  return {
    date: legacy.date,
    planText: legacy.planText,
    factText: legacy.factText,
    goals: {
      dreamGoal: legacy.dreamGoal,
      yearGoals: legacy.yearGoals,
      halfYearGoals: legacy.halfYearGoals,
      quarterGoals: legacy.quarterGoals,
      monthGoals: legacy.monthGoals,
      weekGoals: legacy.weekGoals,
    },
    userProfile: legacy.userProfile,
    openTasks: legacy.openTasks,
  }
}

// ============================================================================
// RESPONSE VALIDATORS
// ============================================================================

function isDailyEvaluationResponse(obj: unknown): obj is DailyEvaluationResponse {
  if (typeof obj !== 'object' || obj === null) return false
  const r = obj as Record<string, unknown>

  // Validate required score fields
  const scoreFields = [
    'dream_progress_score',
    'strategic_focus_score',
    'productivity_score',
    'life_balance_score',
    'discipline_score',
    'overall_score',
  ]

  for (const field of scoreFields) {
    if (!isValidScore(r[field])) {
      console.error(`[Validation] Invalid score for ${field}:`, r[field])
      return false
    }
  }

  // Validate feedback (structured object or string)
  if (typeof r.feedback === 'object' && r.feedback !== null) {
    const fb = r.feedback as Record<string, unknown>
    if (typeof fb.conclusion !== 'string' || fb.conclusion.length === 0) {
      console.error('[Validation] Missing or invalid feedback.conclusion')
      return false
    }
  } else if (typeof r.feedback !== 'string' || (r.feedback as string).length === 0) {
    console.error('[Validation] Missing or invalid feedback')
    return false
  }

  if (typeof r.plan_vs_fact !== 'string') {
    console.error('[Validation] Missing plan_vs_fact')
    return false
  }

  return true
}

function isPeriodEvaluationResponse(obj: unknown): obj is PeriodEvaluationResponse {
  if (typeof obj !== 'object' || obj === null) return false
  const r = obj as Record<string, unknown>

  if (!isValidScore(r.dreamProgressScore)) return false
  if (!isValidScore(r.overallScore)) return false
  if (typeof r.feedback !== 'string' || r.feedback.length === 0) return false

  return true
}

function isForecastResponse(obj: unknown): obj is ForecastResponse {
  if (typeof obj !== 'object' || obj === null) return false
  const r = obj as Record<string, unknown>

  if (typeof r.dreamForecast !== 'object' || r.dreamForecast === null) return false
  if (typeof r.summary !== 'string' || r.summary.length === 0) return false

  return true
}

// Тип для возврата usage информации
export interface AIUsageInfo {
  model: string
  inputTokens: number
  outputTokens: number
  durationMs: number
}

export interface EvaluationResultWithUsage {
  result: DailyEvaluationResponse
  usage: AIUsageInfo
}

// НОВАЯ функция оценки дня с Prompt Caching
export async function evaluateDayNew(
  request: DailyEvaluationRequest
): Promise<DailyEvaluationResponse> {
  const { result } = await evaluateDayNewWithUsage(request)
  return result
}

// Версия с возвратом usage для логирования
export async function evaluateDayNewWithUsage(
  request: DailyEvaluationRequest
): Promise<EvaluationResultWithUsage> {
  const startTime = Date.now()
  
  // Проверка наличия мечты и целей
  const validation = validateGoals(request)
  if (!validation.valid && validation.response) {
    return {
      result: validation.response,
      usage: { model: 'none', inputTokens: 0, outputTokens: 0, durationMs: 0 },
    }
  }

  // Sanitize user inputs to prevent prompt injection
  const sanitizedRequest: DailyEvaluationRequest = {
    ...request,
    planText: sanitizeUserInput(request.planText),
    factText: sanitizeUserInput(request.factText),
    goals: {
      ...request.goals,
      dreamGoal: sanitizeUserInput(request.goals.dreamGoal, 1000),
    },
  }

  // Построение user промпта со всеми данными (мечта, цели, план/факт)
  const userPrompt = buildUserDataPrompt(sanitizedRequest)

  // Вызов Claude API с Prompt Caching и retry логикой
  const message = await withRetry(async () => {
    return getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: DAILY_EVALUATION_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }, // Кэшируем инструкции на 5 минут
        },
      ],
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    })
  })

  const durationMs = Date.now() - startTime

  // Логируем статистику кэширования
  logCacheStats('evaluateDayNew', message.usage)

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  // Извлечение и валидация JSON из ответа
  const parsedResponse = extractJsonFromAIResponse<DailyEvaluationResponse>(
    responseText,
    isDailyEvaluationResponse,
    'evaluateDayNew'
  )

  // Clamp scores to valid range (safety measure)
  const result = {
    ...parsedResponse,
    dream_progress_score: clampScore(parsedResponse.dream_progress_score),
    strategic_focus_score: clampScore(parsedResponse.strategic_focus_score),
    productivity_score: clampScore(parsedResponse.productivity_score),
    life_balance_score: clampScore(parsedResponse.life_balance_score),
    discipline_score: clampScore(parsedResponse.discipline_score),
    overall_score: clampScore(parsedResponse.overall_score),
  }

  return {
    result,
    usage: {
      model: 'claude-sonnet-4-5-20250929',
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      durationMs,
    },
  }
}

// СТАРАЯ функция для обратной совместимости (deprecated)
export async function evaluateDay(
  request: EvaluationRequest
): Promise<EvaluationResponse> {
  // Конвертируем старый формат в новый
  const newRequest = convertLegacyRequest(request)

  // Вызываем новую функцию
  const newResponse = await evaluateDayNew(newRequest)

  // Конвертируем ответ обратно в старый формат
  return {
    strategic_focus_score: newResponse.strategic_focus_score,
    productivity_score: newResponse.productivity_score,
    life_balance_score: newResponse.life_balance_score,
    discipline_score: newResponse.discipline_score,
    overall_score: newResponse.overall_score,
    plan_vs_fact: newResponse.plan_vs_fact,
    feedback: typeof newResponse.feedback === 'object'
      ? `${newResponse.feedback.conclusion}\n${newResponse.feedback.worked}\n${newResponse.feedback.blocks}`
      : newResponse.feedback as unknown as string,
    alignment: newResponse.alignment,
    recommendations: newResponse.recommendations,
  }
}

// Функция оценки периода (неделя/месяц/квартал/год)
export async function evaluatePeriod(
  request: PeriodEvaluationRequest
): Promise<PeriodEvaluationResponse> {
  // Построение промпта для периодической оценки
  const prompt = buildPeriodEvaluationPrompt(request)

  // Вызов Claude API с кэшированием и retry логикой
  const message = await withRetry(async () => {
    return getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-20250514', // Sonnet для периодических оценок
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
      ],
    })
  })

  // Логируем статистику кэширования
  logCacheStats('evaluatePeriod', message.usage)

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  // Извлечение и валидация JSON из ответа
  const parsedResponse = extractJsonFromAIResponse<PeriodEvaluationResponse>(
    responseText,
    isPeriodEvaluationResponse,
    'evaluatePeriod'
  )

  // Clamp scores to valid range
  return {
    ...parsedResponse,
    dreamProgressScore: clampScore(parsedResponse.dreamProgressScore),
    overallScore: clampScore(parsedResponse.overallScore),
  }
}

// Функция прогноза
export async function generateForecast(
  request: ForecastRequest
): Promise<ForecastResponse> {
  // Построение промпта для прогноза
  const prompt = buildForecastPrompt(request)

  // Вызов Claude API с кэшированием и retry логикой
  const message = await withRetry(async () => {
    return getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
      ],
    })
  })

  // Логируем статистику кэширования
  logCacheStats('generateForecast', message.usage)

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  // Извлечение и валидация JSON из ответа
  return extractJsonFromAIResponse<ForecastResponse>(
    responseText,
    isForecastResponse,
    'generateForecast'
  )
}

// === ОБНОВЛЕНИЕ ПРОФИЛЯ ПОНИМАНИЯ ПОЛЬЗОВАТЕЛЯ ===

export interface UserInsightsUpdate {
  patterns?: string
  strengths?: string
  challenges?: string
  preferences?: string
  recommendations?: string
  motivators?: string
}

export interface UpdateInsightsRequest {
  currentInsights: UserInsightsUpdate | null
  evaluationCount: number
  // Данные для анализа
  planText: string
  factText: string
  evaluationFeedback: string
  dreamProgressScore: number
  overallScore: number
  date: string // YYYY-MM-DD дата оцениваемого дня
  // Последние N дней для контекста
  recentDays?: Array<{
    date: string
    planTasks: number
    completedTasks: number
    dreamScore: number
    overallScore: number
  }>
  // Накопленные наблюдения из кэша
  knowledgeCache?: Array<{
    date: string
    category: string
    text: string
  }>
}

const UPDATE_INSIGHTS_PROMPT = `Ты помощник по продуктивности. Твоя задача — обновить профиль понимания пользователя на основе его планов и результатов.

ТЕКУЩИЙ ПРОФИЛЬ (если есть):
{current_insights}

НАКОПЛЕННЫЕ ЗНАНИЯ О ПОЛЬЗОВАТЕЛЕ:
{knowledge_cache}

ДАННЫЕ СЕГОДНЯШНЕГО ДНЯ:
- Дата: {date}
- План: {plan_text}
- Выполнено: {fact_text}
- Оценка дня: {overall_score}/10
- Приближение к мечте: {dream_score}/10
- Обратная связь: {feedback}

ИСТОРИЯ ПОСЛЕДНИХ ДНЕЙ:
{recent_days}

КОЛИЧЕСТВО ОЦЕНЁННЫХ ДНЕЙ: {evaluation_count}

ЗАДАЧА:
1. Обнови обобщённый профиль на основе ВСЕХ накопленных знаний + нового дня
2. Извлеки из СЕГОДНЯШНЕГО ДНЯ конкретные наблюдения-факты о пользователе

Верни JSON:
{
  "profile": {
    "patterns": "Обобщённые паттерны поведения на основе ВСЕХ данных",
    "strengths": "Сильные стороны (на основе всех наблюдений)",
    "challenges": "Сложности и зоны роста",
    "preferences": "Предпочтения в планировании",
    "recommendations": "Персональные рекомендации",
    "motivators": "Что мотивирует пользователя"
  },
  "entries": [
    {"category": "pattern", "text": "конкретное наблюдение из сегодняшнего дня"},
    {"category": "strength", "text": "что получилось хорошо"},
    {"category": "challenge", "text": "с чем были сложности"},
    {"category": "observation", "text": "любой важный факт о пользователе"}
  ]
}

КАТЕГОРИИ для entries:
- pattern — замеченный паттерн поведения (откладывает, делает утром, перевыполняет)
- strength — проявленная сильная сторона
- challenge — проблема или сложность
- preference — выявленное предпочтение
- motivator — что дало энергию/мотивацию
- observation — любой важный факт о пользователе

ПРАВИЛА:
- В entries пиши ТОЛЬКО конкретные факты из СЕГОДНЯШНЕГО дня (2-5 штук)
- В profile обобщай ВСЕ накопленные знания + новый день
- Будь конкретен, избегай общих фраз
- Пиши на русском языке
- Отвечай ТОЛЬКО JSON без пояснений`

export interface InsightEntryData {
  category: string
  text: string
}

export interface UpdateInsightsResponse {
  profile: UserInsightsUpdate
  entries: InsightEntryData[]
}

function isUpdateInsightsResponse(obj: unknown): obj is UpdateInsightsResponse {
  if (typeof obj !== 'object' || obj === null) return false
  const r = obj as Record<string, unknown>
  // Accept both new format (profile+entries) and legacy format (flat fields)
  if (r.profile && typeof r.profile === 'object') {
    return true
  }
  // Legacy flat format — wrap it
  return (
    typeof r.patterns === 'string' ||
    typeof r.strengths === 'string' ||
    typeof r.challenges === 'string'
  )
}

function normalizeInsightsResponse(raw: UpdateInsightsResponse | UserInsightsUpdate): UpdateInsightsResponse {
  // Legacy flat format
  if (!('profile' in raw)) {
    return { profile: raw as UserInsightsUpdate, entries: [] }
  }
  return raw as UpdateInsightsResponse
}

export async function updateUserInsights(
  request: UpdateInsightsRequest
): Promise<UpdateInsightsResponse> {
  const currentInsightsText = request.currentInsights
    ? JSON.stringify(request.currentInsights, null, 2)
    : 'Профиль пока не сформирован'

  const recentDaysText = request.recentDays && request.recentDays.length > 0
    ? request.recentDays.map(d =>
        `- ${d.date}: ${d.completedTasks}/${d.planTasks} задач, мечта: ${d.dreamScore}/10, день: ${d.overallScore}/10`
      ).join('\n')
    : 'Нет данных'

  const knowledgeCacheText = request.knowledgeCache && request.knowledgeCache.length > 0
    ? request.knowledgeCache.map(e => `- [${e.date}] (${e.category}) ${e.text}`).join('\n')
    : 'Пока нет накопленных наблюдений'

  // Sanitize user inputs and use function replacement to avoid double replacement attacks
  const prompt = UPDATE_INSIGHTS_PROMPT
    .replace('{current_insights}', () => sanitizeUserInput(currentInsightsText))
    .replace('{knowledge_cache}', () => sanitizeUserInput(knowledgeCacheText))
    .replace('{date}', () => sanitizeUserInput(request.date))
    .replace('{plan_text}', () => sanitizeUserInput(request.planText))
    .replace('{fact_text}', () => sanitizeUserInput(request.factText))
    .replace('{overall_score}', () => String(request.overallScore))
    .replace('{dream_score}', () => String(request.dreamProgressScore))
    .replace('{feedback}', () => sanitizeUserInput(request.evaluationFeedback))
    .replace('{recent_days}', () => sanitizeUserInput(recentDaysText))
    .replace('{evaluation_count}', () => String(request.evaluationCount))

  // Используем Haiku с retry логикой
  const message = await withRetry(async () => {
    return getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })
  })

  logCacheStats('updateUserInsights', message.usage)

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  const raw = extractJsonFromAIResponse<UpdateInsightsResponse | UserInsightsUpdate>(
    responseText,
    isUpdateInsightsResponse,
    'updateUserInsights'
  )

  return normalizeInsightsResponse(raw)
}
