import { sanitizeUserInput } from '@/lib/api-utils'
import { NO_EMOJI_OUTPUT_RULE } from './core'

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

export interface InsightEntryData {
  category: string
  text: string
}

export interface UpdateInsightsResponse {
  profile: UserInsightsUpdate
  entries: InsightEntryData[]
}

const UPDATE_INSIGHTS_PROMPT = `Ты помощник по продуктивности. Твоя задача — обновить профиль понимания пользователя на основе его планов и результатов.

${NO_EMOJI_OUTPUT_RULE}

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
    "preferences": "Предпочтения в планировании: ВСЕ пункты текущего профиля плюс новое",
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
- Поле preferences текущего профиля мог записать чат планирования со слов пользователя (режим питания, отношение к перерывам, привычные окна дня). Перенеси эти пункты в новое preferences и только дополняй их. Удалить или изменить такой пункт можно, только если данные сегодняшнего дня ему прямо противоречат
- Если по какому-то полю нечего добавить, верни его прежнее значение из текущего профиля, а не пустую строку
- Будь конкретен, избегай общих фраз
- Пиши на русском языке
- Отвечай ТОЛЬКО JSON без пояснений`

// Построение промпта обновления insights с подстановкой плейсхолдеров.
// Замена через функцию-колбэк (.replace('{x}', () => ...)) — защита от double-replacement
// атак: если санитизированное значение само содержит подстроку вида "{y}",
// она не будет интерпретирована как ещё один плейсхолдер на следующем шаге replace.
export function buildUpdateInsightsPrompt(request: UpdateInsightsRequest): string {
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

  return UPDATE_INSIGHTS_PROMPT
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
}
