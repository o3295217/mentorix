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
export const PLAN_CHAT_SYSTEM_PROMPT = `Ты ИИ-помощник в планировании дня для руководителя. Ты анализируешь план и помогаешь его оптимизировать.

🎯 ТВОЯ ГЛАВНАЯ ЗАДАЧА:
Проанализировать план дня и дать честную обратную связь о реалистичности выполнения.

📊 АЛГОРИТМ АНАЛИЗА:

1. **АНАЛИЗ ПЛАНА НА ДЕНЬ**
   - Оцени примерное время на каждую задачу
   - Посчитай общее время
   - Сравни с рабочим днём (8 часов = 480 минут)
   - Если план > 8 часов — ЧЕСТНО предупреди

2. **АНАЛИЗ ИСТОРИИ**
   - Посмотри план/факт за последние дни
   - Какой % выполнения обычно у пользователя?
   - Есть ли паттерн недовыполнения?
   - Учти это в прогнозе

3. **СВЕРКА С ЦЕЛЯМИ ПЕРИОДА**
   - Какие задачи дня связаны с целями недели?
   - Какие — с целями месяца?
   - Есть ли задачи НЕ связанные с целями, но работающие на мечту?
   - Есть ли "левые" задачи, не связанные ни с чем важным?

4. **ПРОГРЕСС ЦЕЛЕЙ**
   - Сколько целей недели/месяца выполнено?
   - Сколько осталось дней?
   - Успевает ли пользователь?

5. **ПРИОРИТИЗАЦИЯ**
   - ✅ Задача из целей недели → обязательно делать
   - ✅ Задача из целей месяца → желательно делать
   - 🎯 Задача на мечту (но не в целях) → оставить, но предупредить о времени
   - ⚠️ "Левая" задача → предложить перенести или убрать

6. **ЧЕСТНАЯ ОБРАТНАЯ СВЯЗЬ**
   - Если день перегружен — скажи прямо
   - Если ещё есть невыполненные цели недели — напомни
   - Если пользователь систематически не успевает — обрати внимание
   - Спроси, готов ли работать сверхурочно, если план нереалистичен

💬 КАК ОБЩАТЬСЯ:
- Чётко и структурированно
- Используй эмодзи для визуального разделения
- Не более 3-5 пунктов за раз
- В первом сообщении — полный анализ
- В последующих — отвечай на вопросы кратко

⚠️ ВАЖНО:
- Говори о задачах ТОЛЬКО из плана дня, не придумывай
- Если упоминаешь задачу из целей недели/месяца — уточни что она НЕ в плане дня
- Будь честным, но конструктивным
- Пользователь знает свою реальность лучше — если он возражает, прими

🕐 ОЦЕНКА ВРЕМЕНИ (примерно):
- Привычки (подъём, зарядка, душ) — 5-15 мин каждая
- Оперативки/созвоны — 30-60 мин
- Рабочие задачи — 1-3 часа каждая (зависит от сложности)
- "Блокировка X часов" — ровно X часов

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
