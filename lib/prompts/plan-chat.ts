import { UserProfile } from './types'
import { formatUserProfile } from './core'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Профиль понимания пользователя (обновляется ИИ после оценки дня)
export interface UserInsights {
  patterns?: string | null
  strengths?: string | null
  challenges?: string | null
  preferences?: string | null
  recommendations?: string | null
  motivators?: string | null
  evaluationCount?: number
}

export interface PlanChatRequest {
  date: string
  dayOfWeek: string
  planTasks: string[]
  completedTasks: string[] // Отмеченные чекбоксами
  weekGoals: string[]
  monthGoals: string[]
  dreamGoal: string
  messages: ChatMessage[] // История диалога
  profile?: UserProfile
  insights?: UserInsights // Профиль понимания пользователя
}

// Системный промпт для чата о плане дня
export const PLAN_CHAT_SYSTEM_PROMPT = `Ты ИИ-помощник в планировании дня. Ты помогаешь пользователю составить реалистичный план и обсуждаешь его.

🎯 ТВОЯ РОЛЬ:
- Помочь составить эффективный план дня
- Отвечать на вопросы о плане
- Учитывать возражения и уточнения пользователя
- Давать практичные советы
- ИСПОЛЬЗОВАТЬ знания о пользователе для персонализации

📋 У ТЕБЯ ЕСТЬ КОНТЕКСТ:
- План на день (задачи)
- Какие задачи уже отмечены как выполненные
- Цели недели и месяца
- Мечта пользователя
- Профиль пользователя (если есть)
- ПРОФИЛЬ ПОНИМАНИЯ - накопленные знания о паттернах, сильных сторонах и сложностях пользователя

💬 КАК ОБЩАТЬСЯ:
- Кратко и по делу (2-4 предложения)
- Если пользователь возражает - принимай его точку зрения, он знает контекст лучше
- Можешь предложить альтернативы
- Не навязывай, а помогай
- УЧИТЫВАЙ паттерны поведения из профиля понимания
- Если знаешь о сложностях пользователя - учитывай их в рекомендациях

⚠️ ВАЖНО:
- Пользователь знает свою реальность лучше тебя
- Если он говорит "это невозможно сегодня" - прими это
- Твоя задача - ПОМОЧЬ, а не указывать
- Опирайся на профиль понимания для персональных рекомендаций

Отвечай на русском языке. Не используй JSON, отвечай обычным текстом.`

export function buildPlanChatContext(request: PlanChatRequest): string {
  const parts: string[] = []
  
  parts.push(`📅 ДАТА: ${request.date} (${request.dayOfWeek})`)
  
  // Профиль
  if (request.profile) {
    parts.push(`\n👤 ПРОФИЛЬ:\n${formatUserProfile(request.profile)}`)
  }
  
  // Профиль понимания пользователя (персонализация)
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
  }
  
  // Цели недели
  if (request.weekGoals.length > 0) {
    parts.push(`\n📅 ЦЕЛИ НЕДЕЛИ:`)
    request.weekGoals.forEach((goal, i) => {
      parts.push(`${i + 1}. ${goal}`)
    })
  }
  
  // План дня
  if (request.planTasks.length > 0) {
    parts.push(`\n📋 ПЛАН НА ДЕНЬ:`)
    request.planTasks.forEach((task, i) => {
      const isCompleted = request.completedTasks.includes(task)
      parts.push(`${i + 1}. ${isCompleted ? '✅' : '☐'} ${task}`)
    })
  } else {
    parts.push(`\n📋 ПЛАН НА ДЕНЬ: пусто`)
  }
  
  // Статистика выполнения
  if (request.planTasks.length > 0) {
    const completed = request.completedTasks.length
    const total = request.planTasks.length
    const percent = Math.round((completed / total) * 100)
    parts.push(`\n📊 ВЫПОЛНЕНО: ${completed}/${total} (${percent}%)`)
  }
  
  return parts.join('\n')
}
