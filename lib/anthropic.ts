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

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 2,
  timeout: 5 * 60 * 1000, // 5 minutes timeout for the HTTP client
})

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
  strategy_score: number
  operations_score: number
  team_score: number
  efficiency_score: number
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

// НОВАЯ функция оценки дня с Prompt Caching
export async function evaluateDayNew(
  request: DailyEvaluationRequest
): Promise<DailyEvaluationResponse> {
  // Проверка наличия мечты и целей
  const validation = validateGoals(request)
  if (!validation.valid && validation.response) {
    return validation.response
  }

  // Построение user промпта со всеми данными (мечта, цели, план/факт)
  const userPrompt = buildUserDataPrompt(request)

  // Вызов Claude API с Prompt Caching
  // System prompt: ТОЛЬКО инструкции (кэшируются, ~3500 токенов)
  // User message: все данные пользователя (НЕ кэшируются - всегда актуальные)
  const message = await anthropic.messages.create({
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

  // Логируем статистику кэширования
  logCacheStats('evaluateDayNew', message.usage)

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  // Извлечение JSON из ответа (Claude может обернуть в markdown)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('Claude response without JSON:', responseText)
    throw new Error('Failed to parse evaluation response from Claude')
  }

  let parsedResponse: DailyEvaluationResponse
  try {
    parsedResponse = JSON.parse(jsonMatch[0])
  } catch (e) {
    console.error('Invalid JSON from Claude:', jsonMatch[0])
    throw new Error('Claude returned invalid JSON response')
  }

  // Валидация ответа
  if (
    !parsedResponse.dream_progress_score ||
    !parsedResponse.overall_score ||
    !parsedResponse.feedback
  ) {
    throw new Error('Invalid evaluation response structure')
  }

  return parsedResponse
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
    strategy_score: newResponse.strategy_score,
    operations_score: newResponse.operations_score,
    team_score: newResponse.team_score,
    efficiency_score: newResponse.efficiency_score,
    overall_score: newResponse.overall_score,
    plan_vs_fact: newResponse.plan_vs_fact,
    feedback: newResponse.feedback,
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

  // Вызов Claude API с кэшированием (используем Haiku для скорости)
  const message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022', // Быстрая модель для периодических оценок
    max_tokens: 8192, // Увеличен лимит для более длинных ответов
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
            cache_control: { type: 'ephemeral' }, // Кэшируем промпт на 5 минут
          },
        ],
      },
    ],
  })

  // Логируем статистику кэширования
  logCacheStats('evaluatePeriod', message.usage)

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  // Извлечение JSON из ответа
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('Claude response without JSON:', responseText)
    throw new Error('Failed to parse period evaluation response from Claude')
  }

  let parsedResponse: PeriodEvaluationResponse
  try {
    parsedResponse = JSON.parse(jsonMatch[0])
  } catch (e) {
    console.error('Invalid JSON from Claude:', jsonMatch[0])
    throw new Error('Claude returned invalid JSON response for period evaluation')
  }

  // Валидация ответа
  if (
    !parsedResponse.dreamProgressScore ||
    !parsedResponse.overallScore ||
    !parsedResponse.feedback
  ) {
    throw new Error('Invalid period evaluation response structure')
  }

  return parsedResponse
}

// Функция прогноза
export async function generateForecast(
  request: ForecastRequest
): Promise<ForecastResponse> {
  // Построение промпта для прогноза
  const prompt = buildForecastPrompt(request)

  // Вызов Claude API с кэшированием
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
            cache_control: { type: 'ephemeral' }, // Кэшируем промпт на 5 минут
          },
        ],
      },
    ],
  })

  // Логируем статистику кэширования
  logCacheStats('generateForecast', message.usage)

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  // Извлечение JSON из ответа
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('Claude response without JSON:', responseText)
    throw new Error('Failed to parse forecast response from Claude')
  }

  let parsedResponse: ForecastResponse
  try {
    parsedResponse = JSON.parse(jsonMatch[0])
  } catch (e) {
    console.error('Invalid JSON from Claude:', jsonMatch[0])
    throw new Error('Claude returned invalid JSON response for forecast')
  }

  // Валидация ответа
  if (!parsedResponse.dreamForecast || !parsedResponse.summary) {
    throw new Error('Invalid forecast response structure')
  }

  return parsedResponse
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
  // Последние N дней для контекста
  recentDays?: Array<{
    date: string
    planTasks: number
    completedTasks: number
    dreamScore: number
    overallScore: number
  }>
}

const UPDATE_INSIGHTS_PROMPT = `Ты помощник по продуктивности. Твоя задача — обновить профиль понимания пользователя на основе его планов и результатов.

ТЕКУЩИЙ ПРОФИЛЬ (если есть):
{current_insights}

ДАННЫЕ СЕГОДНЯШНЕГО ДНЯ:
- План: {plan_text}
- Выполнено: {fact_text}
- Оценка дня: {overall_score}/10
- Приближение к мечте: {dream_score}/10
- Обратная связь: {feedback}

ИСТОРИЯ ПОСЛЕДНИХ ДНЕЙ:
{recent_days}

КОЛИЧЕСТВО ОЦЕНЁННЫХ ДНЕЙ: {evaluation_count}

ЗАДАЧА:
На основе накопленных данных обнови или сформируй профиль понимания пользователя.

Верни JSON:
{
  "patterns": "Выявленные паттерны поведения (продуктивное время, склонность откладывать, и т.д.)",
  "strengths": "Сильные стороны пользователя",
  "challenges": "Сложности и зоны роста",
  "preferences": "Предпочтения в планировании (количество задач, типы задач)",
  "recommendations": "Персональные рекомендации для повышения эффективности",
  "motivators": "Что мотивирует пользователя (если удалось выявить)"
}

ВАЖНО:
- Если данных мало (< 5 дней), делай осторожные выводы
- Обновляй существующий профиль, а не заменяй полностью
- Будь конкретен, избегай общих фраз
- Пиши на русском языке
- Отвечай ТОЛЬКО JSON без пояснений`

export async function updateUserInsights(
  request: UpdateInsightsRequest
): Promise<UserInsightsUpdate> {
  const currentInsightsText = request.currentInsights
    ? JSON.stringify(request.currentInsights, null, 2)
    : 'Профиль пока не сформирован'

  const recentDaysText = request.recentDays && request.recentDays.length > 0
    ? request.recentDays.map(d => 
        `- ${d.date}: ${d.completedTasks}/${d.planTasks} задач, мечта: ${d.dreamScore}/10, день: ${d.overallScore}/10`
      ).join('\n')
    : 'Нет данных'

  const prompt = UPDATE_INSIGHTS_PROMPT
    .replace('{current_insights}', currentInsightsText)
    .replace('{plan_text}', request.planText)
    .replace('{fact_text}', request.factText)
    .replace('{overall_score}', String(request.overallScore))
    .replace('{dream_score}', String(request.dreamProgressScore))
    .replace('{feedback}', request.evaluationFeedback)
    .replace('{recent_days}', recentDaysText)
    .replace('{evaluation_count}', String(request.evaluationCount))

  // Используем Haiku — дешевле для этой задачи
  const message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  logCacheStats('updateUserInsights', message.usage)

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('Claude response without JSON:', responseText)
    throw new Error('Failed to parse insights response from Claude')
  }

  try {
    return JSON.parse(jsonMatch[0])
  } catch (e) {
    console.error('Invalid JSON from Claude:', jsonMatch[0])
    throw new Error('Claude returned invalid JSON for insights')
  }
}
