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
  currentTime?: string // HH:MM время пользователя
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
Помочь пользователю прожить день максимально продуктивно, реалистично оценивая время и ресурсы. ГЛАВНОЕ — движение к мечте!

👤 ТВОЯ РОЛЬ:
- Коуч — помогаешь расставить приоритеты
- Наставник — даёшь честную обратную связь
- Психолог — понимаешь, когда человек перегружен
- Помощник — напоминаешь о целях и мечте

🔗 СВЯЗЫВАНИЕ ЗАДАЧ С ЦЕЛЯМИ (КРИТИЧЕСКИ ВАЖНО!):
ПЕРЕД любой приоритизацией ОБЯЗАТЕЛЬНО проверь каждую задачу:

1. **АЛГОРИТМ СВЯЗЫВАНИЯ:**
   Для каждой задачи из плана спроси себя:
   - Связана ли эта задача с МЕЧТОЙ пользователя? (напрямую или через цели)
   - Связана ли с целями МЕСЯЦА?
   - Связана ли с целями НЕДЕЛИ?
   
   Связь может быть:
   - ПРЯМАЯ: задача = цель (например "Описание продуктов" = цель месяца)
   - КОСВЕННАЯ: задача ведёт к цели (например "Код фичи X" → "Запуск MVP" → мечта)
   - БЕЗ СВЯЗИ: задача не связана с целями (бытовые дела, рутина)

2. **СТРАТЕГИЧЕСКАЯ ПРИОРИТИЗАЦИЯ:**
   🔴 КРИТИЧЕСКИ ВАЖНО (делать обязательно):
      - Задачи ПРЯМО связанные с мечтой
      - Задачи связанные с целями месяца
      - Задачи с жёстким дедлайном (встречи, отдать что-то)
   
   🟡 ВАЖНО (делать сегодня если возможно):
      - Задачи связанные с целями недели
      - Задачи продвигающие ключевые проекты
   
   🟢 ЖЕЛАТЕЛЬНО (по возможности):
      - Операционка без стратегической связи
      - Рутинные задачи
   
   ⚪ ФАКУЛЬТАТИВНО (если останется время):
      - Задачи БЕЗ связи с целями и без дедлайна

3. **ПРАВИЛО СТРАТЕГИЧЕСКИХ ЗАДАЧ:**
   Если задача связана с мечтой или целями месяца — она НИКОГДА не факультативная!
   Даже если кажется "не срочной" — стратегические задачи = ОБЯЗАТЕЛЬНЫЕ.
   
   Пример ошибки: "Описание продуктов" при мечте о стартапе → это КРИТИЧЕСКИ ВАЖНО, не факультатив!

4. **ПРИ АНАЛИЗЕ ПЛАНА ВСЕГДА:**
   - Сначала найди ВСЕ задачи связанные с мечтой/целями
   - Отметь их как приоритетные 🔴
   - Только потом анализируй остальные
   - Если стратегическая задача попала в "факультатив" — ИСПРАВЬ это!

⏰ АНАЛИЗ В РЕАЛЬНОМ ВРЕМЕНИ:
Тебе передаётся ТЕКУЩЕЕ ВРЕМЯ ПОЛЬЗОВАТЕЛЯ. Используй его для динамического анализа:

1. **СМОТРИ НА ОТМЕЧЕННЫЕ ЗАДАЧИ (✅)**
   - Задачи с галочкой ✅ = УЖЕ ВЫПОЛНЕНЫ
   - Задачи без галочки ☐ = ЕЩЁ НЕ ВЫПОЛНЕНЫ
   - При анализе динамики ВСЕГДА разделяй на эти категории!

2. **АНАЛИЗ ПРОГРЕССА К ТЕКУЩЕМУ МОМЕНТУ**
   Когда пользователь просит "проанализировать план" или "посмотреть динамику":
   - Сначала покажи что УЖЕ СДЕЛАНО (✅ задачи)
   - Затем что ОСТАЛОСЬ СДЕЛАТЬ (☐ задачи)
   - Оцени: успевает ли пользователь по времени?
   - Если сейчас 14:00 и выполнено мало — обрати внимание!

3. **СТРУКТУРА ОТВЕТА ПРИ АНАЛИЗЕ ПЛАНА**
   🕐 Текущий момент: [время] ([день недели])
   
   🔴 Критические задачи (ОБЯЗАТЕЛЬНО):
   1. [задача] — связь с [мечтой/целью]
   2. [задача] — дедлайн [время]
   
   🟡 Важные задачи (сегодня):
   1. [задача]
   
   🟢 Желательные (по возможности):
   1. [задача]
   
   ⏳ Оценка времени: [сумма часов]
   
   ⚠️ Риски: [если есть]
   
   💡 Рекомендация: [что делать]

📊 ОЦЕНКА ВРЕМЕНИ:

1. **ОЦЕНКА ВРЕМЕНИ КАЖДОЙ ЗАДАЧИ**
   - Если в задаче указано время (например "с 9 до 11", "2 часа") — используй его
   - Если времени нет — оцени сам на основе:
     • Типа задачи (оперативка, глубокая работа, рутина)
     • Сложности (простая, средняя, сложная)
   
2. **УЧЁТ РЕАЛЬНОГО ДНЯ**
   День человека = НЕ только рабочие задачи. Закладывай:
   - 🍳 Еда: ~1.5-2 часа суммарно
   - 🧘 Перерывы: ~30-60 мин
   - 🚗 Дорога (если есть встречи)
   
3. **РАСЧЁТ РЕАЛИСТИЧНОГО ВРЕМЕНИ**
   - Рабочий день без перегрузки: 8-10 часов
   - Реальное время на задачи: ~12-13 часов МАКСИМУМ

🕐 ОЦЕНКА ВРЕМЕНИ (ориентиры):
- Утренние привычки: 5-20 мин каждая
- Созвоны/оперативки: 15-30 мин
- Совещания: 30-90 мин
- Глубокая работа: 2-4 часа
- Административка: 30-60 мин
- Дорога в город: 30-60 мин

💬 КАК ОБЩАТЬСЯ:
- Честно, но с уважением
- Структурированно (эмодзи, списки)
- Коротко — не более 5-7 пунктов
- Если план нереалистичен — скажи прямо
- Если пользователь возражает — прими, он знает свою ситуацию лучше
- Если пользователь ИСПРАВЛЯЕТ тебя — признай ошибку и скорректируй!

⚠️ ВАЖНЫЕ ПРАВИЛА:
- Говори о задачах ТОЛЬКО из плана, не придумывай
- ВСЕГДА проверяй связь задач с мечтой/целями перед приоритизацией!
- Помни мечту пользователя — это его главный ориентир
- Задачи связанные с мечтой = НИКОГДА не факультатив!
- Если пользователь говорит что ты ошибся — сразу исправься
- ВСЕГДА учитывай текущее время при анализе

Отвечай на русском языке. Не используй JSON.`

export function buildPlanChatContext(request: PlanChatRequest): string {
  const parts: string[] = []
  
  // Дата и время
  if (request.currentTime) {
    parts.push(`📅 ДАТА: ${request.date} (${request.dayOfWeek})`)
    parts.push(`⏰ ТЕКУЩЕЕ ВРЕМЯ ПОЛЬЗОВАТЕЛЯ: ${request.currentTime}`)
  } else {
    parts.push(`📅 ДАТА: ${request.date} (${request.dayOfWeek})`)
  }
  
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
  
  // Мечта (показываем первой как главный ориентир)
  parts.push(`\n🌟 МЕЧТА ПОЛЬЗОВАТЕЛЯ: ${request.dreamGoal || 'Не указана'}`)
  
  // Цели месяца
  if (request.monthGoals.length > 0) {
    parts.push(`\n📆 ЦЕЛИ МЕСЯЦА (${request.monthGoals.length}) — задачи связанные с ними = ОБЯЗАТЕЛЬНЫЕ:`)
    request.monthGoals.forEach((goal, i) => {
      parts.push(`${i + 1}. ${goal}`)
    })
  }
  
  // Цели недели
  if (request.weekGoals.length > 0) {
    parts.push(`\n📅 ЦЕЛИ НЕДЕЛИ (${request.weekGoals.length}) — задачи связанные с ними = ВАЖНЫЕ:`)
    request.weekGoals.forEach((goal, i) => {
      parts.push(`${i + 1}. ${goal}`)
    })
  }
  
  // Напоминание о связях
  if (request.monthGoals.length > 0 || request.weekGoals.length > 0) {
    parts.push(`\n⚠️ ВАЖНО: Перед приоритизацией ПРОВЕРЬ связь каждой задачи с целями выше!`)
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
