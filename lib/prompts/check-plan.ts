import { UserProfile } from './types'
import { formatUserProfile, NO_EMOJI_OUTPUT_RULE } from './core'

// Профиль понимания пользователя
export interface UserInsights {
  patterns?: string | null
  strengths?: string | null
  challenges?: string | null
  preferences?: string | null
  recommendations?: string | null
  motivators?: string | null
  evaluationCount?: number
}

export interface CheckPlanRequest {
  date: string
  dayOfWeek: string
  planTasks: string[]
  weekGoals: string[]
  monthGoals: string[]
  dreamGoal: string
  recentHistory?: {
    date: string
    planTasks: string[]
    completedTasks: string[]
  }[]
  profile?: UserProfile
  insights?: UserInsights // Профиль понимания пользователя
}

export interface TaskSuggestion {
  goalText: string
  reason: string
  difficulty: 'легко' | 'средне' | 'сложно'
  source: 'week' | 'month'
}

export interface CheckPlanResponse {
  overall: string // Общая оценка плана
  suggestions: TaskSuggestion[] // Предложения добавить задачи
  warnings: string[] // Предупреждения о плане
  tips: string[] // Советы
}

// Промпт для проверки плана дня
export const CHECK_PLAN_SYSTEM_PROMPT = `Ты ИИ-помощник в планировании дня. Твоя задача - помочь пользователю составить реалистичный и эффективный план.

🎯 ГЛАВНАЯ ЦЕЛЬ:
Проанализировать текущий план дня и предложить добавить задачи из целей недели/месяца, которые:
1. Легче выполнить (на основе истории пользователя)
2. Приближают к мечте
3. Не перегружают день

📋 ЧТО ТЫ ДЕЛАЕШЬ:

${NO_EMOJI_OUTPUT_RULE}

1. АНАЛИЗИРУЕШЬ ПЛАН:
   - Сколько задач уже есть
   - Насколько они сложные
   - Есть ли связь с целями недели/месяца

2. СМОТРИШЬ ЦЕЛИ НЕДЕЛИ И МЕСЯЦА:
   - Какие цели еще НЕ в плане дня
   - Какие из них можно разбить на мелкие шаги
   - Какие легче выполнить (на основе истории если есть)

3. ПРЕДЛАГАЕШЬ ЗАДАЧИ:
   - Выбираешь 1-3 цели, которые можно добавить
   - Объясняешь ПОЧЕМУ именно эти (легче/быстрее/важнее)
   - Указываешь сложность: легко/средне/сложно
   - Учитываешь что могут быть зависимости между задачами

4. ПРЕДУПРЕЖДАЕШЬ О РИСКАХ:
   - Если план слишком нагружен
   - Если нет связи с целями
   - Если день выходной - можно меньше нагружать

5. ИСПОЛЬЗУЙ ПРОФИЛЬ ПОНИМАНИЯ:
   - Учитывай известные паттерны поведения
   - Учитывай сложности и сильные стороны
   - Предлагай задачи с учётом предпочтений пользователя

⚠️ ВАЖНО:
- Это РЕКОМЕНДАЦИИ, не приказы
- Пользователь знает контекст лучше (очередность, зависимости)
- Твоя задача - ПОМОЧЬ увидеть возможности
- Не предлагай то что уже есть в плане
- ПЕРСОНАЛИЗИРУЙ на основе профиля понимания

🔍 АНАЛИЗ ИСТОРИИ:
Если есть история - смотри какие задачи пользователь чаще выполняет.
Предлагай похожие по сложности - те что он реально делает.

ФОРМАТ ОТВЕТА - строго JSON:
{
  "overall": "Краткая оценка плана (1-2 предложения)",
  "suggestions": [
    {
      "goalText": "Текст цели для добавления",
      "reason": "Почему стоит добавить",
      "difficulty": "легко|средне|сложно",
      "source": "week|month"
    }
  ],
  "warnings": ["Предупреждение если есть"],
  "tips": ["Полезный совет"]
}

Максимум 3 suggestions, 2 warnings, 2 tips.
Если план хороший - suggestions может быть пустым.`

export function buildCheckPlanPrompt(request: CheckPlanRequest): string {
  const parts: string[] = []
  
  parts.push(`📅 ДАТА: ${request.date} (${request.dayOfWeek})`)
  
  // Профиль пользователя (если есть)
  if (request.profile) {
    parts.push(`\n👤 ПРОФИЛЬ:\n${formatUserProfile(request.profile)}`)
  }
  
  // Профиль понимания пользователя (если есть)
  if (request.insights && request.insights.evaluationCount && request.insights.evaluationCount > 0) {
    parts.push(`\n🧠 ПРОФИЛЬ ПОНИМАНИЯ (на основе ${request.insights.evaluationCount} оценённых дней):`)
    if (request.insights.patterns) {
      parts.push(`• Паттерны: ${request.insights.patterns}`)
    }
    if (request.insights.strengths) {
      parts.push(`• Сильные стороны: ${request.insights.strengths}`)
    }
    if (request.insights.challenges) {
      parts.push(`• Сложности: ${request.insights.challenges}`)
    }
    if (request.insights.preferences) {
      parts.push(`• Предпочтения: ${request.insights.preferences}`)
    }
    if (request.insights.recommendations) {
      parts.push(`• Рекомендации: ${request.insights.recommendations}`)
    }
    if (request.insights.motivators) {
      parts.push(`• Мотивация: ${request.insights.motivators}`)
    }
  }
  
  // Мечта
  parts.push(`\n🌟 МЕЧТА: ${request.dreamGoal || 'Не указана'}`)
  
  // Цели месяца
  if (request.monthGoals.length > 0) {
    parts.push(`\n📆 ЦЕЛИ МЕСЯЦА:`)
    request.monthGoals.forEach((goal, i) => {
      parts.push(`${i + 1}. ${goal}`)
    })
  } else {
    parts.push(`\n📆 ЦЕЛИ МЕСЯЦА: не установлены`)
  }
  
  // Цели недели
  if (request.weekGoals.length > 0) {
    parts.push(`\n📅 ЦЕЛИ НЕДЕЛИ:`)
    request.weekGoals.forEach((goal, i) => {
      parts.push(`${i + 1}. ${goal}`)
    })
  } else {
    parts.push(`\n📅 ЦЕЛИ НЕДЕЛИ: не установлены`)
  }
  
  // Текущий план дня
  if (request.planTasks.length > 0) {
    parts.push(`\n📋 ПЛАН НА ДЕНЬ:`)
    request.planTasks.forEach((task, i) => {
      parts.push(`${i + 1}. ${task}`)
    })
  } else {
    parts.push(`\n📋 ПЛАН НА ДЕНЬ: пусто`)
  }
  
  // История (если есть)
  if (request.recentHistory && request.recentHistory.length > 0) {
    parts.push(`\n📊 ИСТОРИЯ (последние дни):`)
    request.recentHistory.forEach(day => {
      const completed = day.completedTasks.length
      const planned = day.planTasks.length
      const rate = planned > 0 ? Math.round((completed / planned) * 100) : 0
      parts.push(`${day.date}: ${completed}/${planned} выполнено (${rate}%)`)
    })
  }
  
  parts.push(`\nПроанализируй план и предложи улучшения. Ответь строго в JSON формате.`)
  
  return parts.join('\n')
}
