import Anthropic from '@anthropic-ai/sdk'
import {
  DailyEvaluationRequest,
  DailyEvaluationResponse,
  UserProfile,
  GoalsHierarchy,
  DailyContext,
} from './prompts/types'
import { buildCacheablePromptPart, buildDynamicPromptPart, validateGoals } from './prompts/daily'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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

  // Построение промпта с разделением на кэшируемую и динамическую части
  const cacheablePrompt = buildCacheablePromptPart(request)
  const dynamicPrompt = buildDynamicPromptPart(request)

  // Вызов Claude API с Prompt Caching
  // Кэшируемая часть: инструкции + мечта + профиль + годовые цели (меняются редко)
  // Динамическая часть: план/факт дня + месячные/недельные цели (меняются часто)
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: cacheablePrompt,
            cache_control: { type: 'ephemeral' }, // Кэшируем на 5 минут
          },
          {
            type: 'text',
            text: dynamicPrompt,
          },
        ],
      },
    ],
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  // Извлечение JSON из ответа (Claude может обернуть в markdown)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse evaluation response from Claude')
  }

  const parsedResponse = JSON.parse(jsonMatch[0]) as DailyEvaluationResponse

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
