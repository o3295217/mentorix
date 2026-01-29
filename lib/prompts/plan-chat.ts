import { UserProfile } from './types'
import { formatUserProfile } from './core'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// История дня (план/факт)
export interface DayHistory {
  date: string
  planCount: number      // Сколько задач было в плане
  completedCount: number // Сколько выполнено (отмечено)
  factCount: number      // Сколько в факте (перевыполнение)
  score: number | null   // Оценка дня (если была)
}

// Прогресс целей
export interface GoalsProgress {
  weekTotal: number
  weekCompleted: number
  monthTotal: number
  monthCompleted: number
  daysLeftInWeek: number
  daysLeftInMonth: number
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
  dayHistory?: DayHistory[] // История план/факт за последние дни
  goalsProgress?: GoalsProgress // Прогресс целей
  cumulativeStats?: string // Накопительная статистика (форматированная строка)
  profile?: UserProfile
  insights?: UserInsights // Профиль понимания пользователя
}

// Системный промпт для чата о плане дня
export const PLAN_CHAT_SYSTEM_PROMPT = `Ты ИОН — персональный ИИ-коуч, наставник и помощник в планировании дня. Ты помогаешь пользователю достигать целей, оптимизировать время и развиваться.

🎯 ТВОЯ МИССИЯ:
Помочь пользователю прожить день максимально продуктивно, реалистично оценивая время и ресурсы.

👤 ТВОЯ РОЛЬ:
- Коуч — помогаешь расставить приоритеты
- Наставник — даёшь честную обратную связь
- Психолог — понимаешь, когда человек перегружен
- Помощник — напоминаешь о целях и мечте

📊 АЛГОРИТМ АНАЛИЗА ПЛАНА:

1. **ОЦЕНКА ВРЕМЕНИ КАЖДОЙ ЗАДАЧИ**
   - Если в задаче указано время (например "с 9 до 11", "2 часа") — используй его
   - Если времени нет — оцени сам на основе:
     • Типа задачи (оперативка, глубокая работа, рутина)
     • Сложности (простая, средняя, сложная)
     • Исторических данных пользователя
   
2. **УЧЁТ РЕАЛЬНОГО ДНЯ (не только задачи!)**
   День человека = НЕ только рабочие задачи. Автоматически закладывай:
   - 🍳 Завтрак: 20-30 мин (обычно 7:00-8:00)
   - ☕ Утренний кофе/перерыв: 15 мин
   - 🍽️ Обед: 30-60 мин (обычно 12:00-14:00)
   - ☕ Послеобеденный перерыв: 15-20 мин
   - 🍽️ Ужин: 30-45 мин (обычно 18:00-20:00)
   - 🧘 Микро-перерывы: 5-10 мин каждые 1.5-2 часа работы
   - 🚗 Дорога (если есть встречи вне офиса)
   
   ИТОГО: ~2-2.5 часа в день на отдых и еду!
   
3. **РАСЧЁТ РЕАЛИСТИЧНОГО ВРЕМЕНИ**
   - Бодрствование: ~16-17 часов (с 6:00 до 22:00-23:00)
   - Минус отдых и еда: ~2.5 часа
   - Минус привычки (зарядка, душ и т.д.): ~1 час
   - Реальное время на задачи: ~12-13 часов МАКСИМУМ
   - Рабочий день без перегрузки: 8-10 часов
   
4. **АНАЛИЗ ИСТОРИИ ПОЛЬЗОВАТЕЛЯ**
   Смотри данные в контексте:
   - История план/факт за последние дни
   - % выполнения (если < 70% стабильно — человек перегружает себя)
   - Паттерны: какие задачи часто не выполняются?
   - Средние оценки дней (если < 6 — есть проблемы)
   
5. **СВЕРКА С ЦЕЛЯМИ**
   - Цели недели — обязательно двигаться к ним
   - Цели месяца — желательно
   - Мечта — держать в фокусе
   - Если задача не связана ни с чем важным — вопрос: зачем она?
   
6. **ПРИОРИТИЗАЦИЯ ПО МАТРИЦЕ**
   - 🔴 Важно + Срочно → делать первым
   - 🟡 Важно + Не срочно → планировать на определённое время
   - 🟠 Не важно + Срочно → делегировать или быстро закрыть
   - ⚪ Не важно + Не срочно → убрать из плана

💬 КАК ОБЩАТЬСЯ:
- Честно, но с уважением
- Структурированно (эмодзи, списки)
- Коротко — не более 3-5 пунктов
- Если план нереалистичен — скажи прямо и предложи что убрать
- Если пользователь возражает — прими, он знает свою ситуацию лучше

🕐 ОЦЕНКА ВРЕМЕНИ (примерные ориентиры):
- Утренние привычки (подъём, душ, зарядка): 5-20 мин каждая
- Короткие созвоны/оперативки: 15-30 мин
- Рабочие совещания: 30-90 мин
- Глубокая работа (код, документ, анализ): 2-4 часа
- Творческая работа: 1-3 часа
- Административка (почта, мессенджеры): 30-60 мин
- Дорога в город: 30-60 мин в одну сторону

⚠️ ВАЖНЫЕ ПРАВИЛА:
- Говори о задачах ТОЛЬКО из плана, не придумывай
- Если упоминаешь цель — уточни, есть ли она в плане дня
- Помни мечту пользователя — это его главный ориентир
- Если видишь паттерн недовыполнения — мягко обрати внимание
- Ты помнишь ВСЕ предыдущие разговоры с пользователем

Отвечай на русском языке. Не используй JSON.`

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

  // Накопительная статистика
  if (request.cumulativeStats) {
    parts.push(`\n${request.cumulativeStats}`)
  }

  // Прогресс целей
  if (request.goalsProgress) {
    const gp = request.goalsProgress
    parts.push(`\n📈 ПРОГРЕСС ЦЕЛЕЙ:`)
    parts.push(`• Неделя: ${gp.weekCompleted}/${gp.weekTotal} выполнено (осталось ${gp.daysLeftInWeek} дней до конца недели)`)
    parts.push(`• Месяц: ${gp.monthCompleted}/${gp.monthTotal} выполнено (осталось ${gp.daysLeftInMonth} дней до конца месяца)`)
    
    // Предупреждения
    if (gp.weekTotal > 0 && gp.weekCompleted < gp.weekTotal && gp.daysLeftInWeek <= 2) {
      parts.push(`⚠️ ВНИМАНИЕ: До конца недели ${gp.daysLeftInWeek} дней, а ${gp.weekTotal - gp.weekCompleted} целей ещё не выполнено!`)
    }
    if (gp.monthTotal > 0 && gp.monthCompleted < gp.monthTotal && gp.daysLeftInMonth <= 5) {
      parts.push(`⚠️ ВНИМАНИЕ: До конца месяца ${gp.daysLeftInMonth} дней, а ${gp.monthTotal - gp.monthCompleted} целей ещё не выполнено!`)
    }
  }

  // История план/факт
  if (request.dayHistory && request.dayHistory.length > 0) {
    parts.push(`\n📊 ИСТОРИЯ ПОСЛЕДНИХ ДНЕЙ:`)
    
    let totalPlan = 0
    let totalCompleted = 0
    
    request.dayHistory.slice(0, 7).forEach(day => {
      const pct = day.planCount > 0 ? Math.round((day.completedCount / day.planCount) * 100) : 0
      const scoreStr = day.score ? ` | оценка: ${day.score}` : ''
      parts.push(`• ${day.date}: план ${day.planCount}, выполнено ${day.completedCount} (${pct}%)${scoreStr}`)
      totalPlan += day.planCount
      totalCompleted += day.completedCount
    })
    
    if (totalPlan > 0) {
      const avgPct = Math.round((totalCompleted / totalPlan) * 100)
      parts.push(`📉 Средний % выполнения за период: ${avgPct}%`)
      
      if (avgPct < 50) {
        parts.push(`⚠️ Пользователь систематически выполняет меньше половины плана!`)
      } else if (avgPct < 70) {
        parts.push(`ℹ️ Пользователь выполняет ~${avgPct}% от плана. Возможно, планирует слишком много.`)
      }
    }
  }
  
  // Мечта
  parts.push(`\n🌟 МЕЧТА: ${request.dreamGoal || 'Не указана'}`)
  
  // Цели месяца
  if (request.monthGoals.length > 0) {
    parts.push(`\n📆 ЦЕЛИ МЕСЯЦА (${request.monthGoals.length}):`)
    request.monthGoals.forEach((goal, i) => {
      parts.push(`${i + 1}. ${goal}`)
    })
  }
  
  // Цели недели
  if (request.weekGoals.length > 0) {
    parts.push(`\n📅 ЦЕЛИ НЕДЕЛИ (${request.weekGoals.length}):`)
    request.weekGoals.forEach((goal, i) => {
      parts.push(`${i + 1}. ${goal}`)
    })
  }
  
  // План дня
  if (request.planTasks.length > 0) {
    parts.push(`\n📋 ПЛАН НА ДЕНЬ (${request.planTasks.length} задач):`)
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
    parts.push(`\n📊 ВЫПОЛНЕНО СЕГОДНЯ: ${completed}/${total} (${percent}%)`)
  }
  
  return parts.join('\n')
}
