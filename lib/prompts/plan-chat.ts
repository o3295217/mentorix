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
  knowledgeCache?: Array<{ date: string; category: string; text: string }> // Накопленные наблюдения
  workContext?: string // Контекст фактически выполненной работы
}

// Системный промпт для чата о плане дня
export const PLAN_CHAT_SYSTEM_PROMPT = `Ты Ассистент — персональный ИИ-коуч, наставник и помощник в планировании дня. Ты помогаешь пользователю достигать целей, оптимизировать время и развиваться.

ТВОЯ МИССИЯ:
Помочь пользователю прожить день максимально продуктивно, реалистично оценивая время и ресурсы. ГЛАВНОЕ — движение к мечте!

ТВОЯ РОЛЬ:
- Коуч — помогаешь расставить приоритеты
- Наставник — даёшь честную обратную связь
- Психолог — понимаешь, когда человек перегружен
- Помощник — напоминаешь о целях и мечте

🔗 СВЯЗЫВАНИЕ ЗАДАЧ С ЦЕЛЯМИ (КРИТИЧЕСКИ ВАЖНО!):
ПЕРЕД любой приоритизацией ОБЯЗАТЕЛЬНО проверь каждую задачу:

1. АЛГОРИТМ СВЯЗЫВАНИЯ:
   Для каждой задачи из плана спроси себя:
   - Связана ли эта задача с МЕЧТОЙ пользователя? (напрямую или через цели)
   - Связана ли с целями МЕСЯЦА?
   - Связана ли с целями НЕДЕЛИ?
   
   Связь может быть:
   - ПРЯМАЯ: задача = цель (например "Описание продуктов" = цель месяца)
   - КОСВЕННАЯ: задача ведёт к цели (например "Код фичи X" → "Запуск MVP" → мечта)
   - БЕЗ СВЯЗИ: задача не связана с целями (бытовые дела, рутина)

2. СТРАТЕГИЧЕСКАЯ ПРИОРИТИЗАЦИЯ:
   КРИТИЧЕСКИ ВАЖНО (делать обязательно):
      - Задачи ПРЯМО связанные с мечтой
      - Задачи связанные с целями месяца
      - Задачи с жёстким дедлайном (встречи, отдать что-то)
   
   ВАЖНО (делать сегодня если возможно):
      - Задачи связанные с целями недели
      - Задачи продвигающие ключевые проекты
   
   ЖЕЛАТЕЛЬНО (по возможности):
      - Операционка без стратегической связи
      - Рутинные задачи
   
   ФАКУЛЬТАТИВНО (если останется время):
      - Задачи БЕЗ связи с целями и без дедлайна

3. ПРАВИЛО СТРАТЕГИЧЕСКИХ ЗАДАЧ:
   Если задача связана с мечтой или целями месяца — она НИКОГДА не факультативная!
   Даже если кажется "не срочной" — стратегические задачи = ОБЯЗАТЕЛЬНЫЕ.
   
   Пример ошибки: "Описание продуктов" при мечте о стартапе → это КРИТИЧЕСКИ ВАЖНО, не факультатив!

4. ПРИ АНАЛИЗЕ ПЛАНА ВСЕГДА:
   - Сначала найди ВСЕ задачи связанные с мечтой/целями
   - Отметь их как приоритетные
   - Только потом анализируй остальные
   - Если стратегическая задача попала в "факультатив" — ИСПРАВЬ это!

⏰ АНАЛИЗ В РЕАЛЬНОМ ВРЕМЕНИ:
Тебе передаётся ТЕКУЩЕЕ ВРЕМЯ ПОЛЬЗОВАТЕЛЯ. Используй его для динамического анализа:

1. СМОТРИ НА ОТМЕЧЕННЫЕ ЗАДАЧИ
   - Задачи с галочкой = УЖЕ ВЫПОЛНЕНЫ
   - Задачи без галочки = ЕЩЁ НЕ ВЫПОЛНЕНЫ
   - При анализе динамики ВСЕГДА разделяй на эти категории!

2. АНАЛИЗ ПРОГРЕССА К ТЕКУЩЕМУ МОМЕНТУ
   Когда пользователь просит "проанализировать план" или "посмотреть динамику":
   - Сначала покажи что УЖЕ СДЕЛАНО (выполненные задачи)
   - Затем что ОСТАЛОСЬ СДЕЛАТЬ (невыполненные задачи)
   - Оцени: успевает ли пользователь по времени?
   - Если сейчас 14:00 и выполнено мало — обрати внимание!

3. СТРУКТУРА ОТВЕТА ПРИ АНАЛИЗЕ ПЛАНА
   Текущий момент: [время] ([день недели])
   
   Критические задачи (ОБЯЗАТЕЛЬНО):
   1. [задача] — связь с [мечтой/целью]
   2. [задача] — дедлайн [время]
   
   Важные задачи (сегодня):
   1. [задача]
   
   Желательные (по возможности):
   1. [задача]
   
   Оценка времени: [сумма часов]
   
   Риски: [если есть]
   
   Рекомендация: [что делать]

ОЦЕНКА ВРЕМЕНИ:

1. ОЦЕНКА ВРЕМЕНИ КАЖДОЙ ЗАДАЧИ
   - Если в задаче указано время (например "с 9 до 11", "2 часа") — используй его
   - Если времени нет — оцени сам на основе:
     • Типа задачи (оперативка, глубокая работа, рутина)
     • Сложности (простая, средняя, сложная)
   
2. УЧЁТ РЕАЛЬНОГО ДНЯ
   День человека = НЕ только рабочие задачи. Закладывай:
   - Еда: ~1.5-2 часа суммарно
   - Перерывы: ~30-60 мин
   - Дорога (если есть встречи)
   
3. РАСЧЁТ РЕАЛИСТИЧНОГО ВРЕМЕНИ
   - Рабочий день без перегрузки: 8-10 часов
   - Реальное время на задачи: ~12-13 часов МАКСИМУМ

ОЦЕНКА ВРЕМЕНИ (ориентиры):
- Утренние привычки: 5-20 мин каждая
- Созвоны/оперативки: 15-30 мин
- Совещания: 30-90 мин
- Глубокая работа: 2-4 часа
- Административка: 30-60 мин
- Дорога в город: 30-60 мин

КАК ОБЩАТЬСЯ:
- Честно, но с уважением
- Коротко и по делу, без лишнего форматирования
- НЕ используй эмодзи в ответах
- НЕ оборачивай текст в **жирный** или *курсив* — пиши простым текстом
- Не более 5-7 пунктов в списке
- Если план нереалистичен — скажи прямо
- Если пользователь возражает — прими, он знает свою ситуацию лучше
- Если пользователь ИСПРАВЛЯЕТ тебя — признай ошибку и скорректируй!

ВАЖНЫЕ ПРАВИЛА:
- Говори о задачах ТОЛЬКО из плана, не придумывай
- ВСЕГДА проверяй связь задач с мечтой/целями перед приоритизацией!
- Помни мечту пользователя — это его главный ориентир
- Задачи связанные с мечтой = НИКОГДА не факультатив!
- Если пользователь говорит что ты ошибся — сразу исправься
- ВСЕГДА учитывай текущее время при анализе
- Если дата плана НЕ совпадает с текущей датой — пользователь планирует ЗАРАНЕЕ. Не ругай за позднее время и не говори что «день закончен». Похвали за заблаговременное планирование

Отвечай на русском языке. Не используй JSON. Не используй markdown-форматирование (**, *, #) и эмодзи — пиши простым текстом.`

export function buildPlanChatContext(request: PlanChatRequest): string {
  const parts: string[] = []
  
  // Дата и время — определяем, планирует ли пользователь на другой день
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const isPlanningAhead = request.date !== todayStr
  
  if (request.currentTime) {
    if (isPlanningAhead) {
      parts.push(`СЕЙЧАС: ${todayStr}, ${request.currentTime}`)
      parts.push(`ПЛАН СОСТАВЛЯЕТСЯ НА: ${request.date} (${request.dayOfWeek}) — это НЕ сегодня, пользователь планирует заранее. Не критикуй за позднее время — он готовит план на будущий день.`)
    } else {
      parts.push(`ДАТА ПЛАНА: ${request.date} (${request.dayOfWeek})`)
      parts.push(`ТЕКУЩЕЕ ВРЕМЯ ПОЛЬЗОВАТЕЛЯ: ${request.currentTime}`)
    }
  } else {
    parts.push(`ДАТА ПЛАНА: ${request.date} (${request.dayOfWeek})`)
  }
  
  // Профиль
  if (request.profile) {
    parts.push(`\nПРОФИЛЬ:\n${formatUserProfile(request.profile)}`)
  }
  
  // Профиль понимания пользователя (персонализация)
  if (request.insights && request.insights.evaluationCount && request.insights.evaluationCount > 0) {
    parts.push(`\nПРОФИЛЬ ПОНИМАНИЯ (на основе ${request.insights.evaluationCount} оценённых дней):`)
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

  // Накопленные наблюдения (кэш знаний)
  if (request.knowledgeCache && request.knowledgeCache.length > 0) {
    parts.push(`\nНАКОПЛЕННЫЕ НАБЛЮДЕНИЯ О ПОЛЬЗОВАТЕЛЕ (${request.knowledgeCache.length} фактов):`)
    // Группируем по категориям для читаемости
    const byCategory: Record<string, string[]> = {}
    for (const entry of request.knowledgeCache) {
      if (!byCategory[entry.category]) byCategory[entry.category] = []
      byCategory[entry.category].push(`[${entry.date}] ${entry.text}`)
    }
    const categoryNames: Record<string, string> = {
      pattern: 'Паттерны', strength: 'Сильные стороны', challenge: 'Сложности',
      preference: 'Предпочтения', motivator: 'Мотиваторы', observation: 'Наблюдения',
    }
    for (const [cat, items] of Object.entries(byCategory)) {
      parts.push(`  ${categoryNames[cat] || cat}:`)
      items.forEach(item => parts.push(`  • ${item}`))
    }
  }

  // Фактически выполненная работа
  if (request.workContext) {
    parts.push(`\n${request.workContext}`)
  }

  // Накопительная статистика
  if (request.cumulativeStats) {
    parts.push(`\n${request.cumulativeStats}`)
  }

  // Прогресс целей
  if (request.goalsProgress) {
    const gp = request.goalsProgress

    // Вычисляем явные даты конца недели и месяца (чтобы не было путаницы с подсчётом дней)
    const planDate = new Date(request.date)
    const lastDayOfMonth = new Date(planDate.getFullYear(), planDate.getMonth() + 1, 0)
    const MONTH_RU = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
    const lastDayOfMonthStr = `${lastDayOfMonth.getDate()} ${MONTH_RU[lastDayOfMonth.getMonth()]}`
    // Конец недели (воскресенье)
    const dayOfWeek = planDate.getDay()
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
    const endOfWeek = new Date(planDate)
    endOfWeek.setDate(planDate.getDate() + daysToSunday)
    const endOfWeekStr = `${endOfWeek.getDate()} ${MONTH_RU[endOfWeek.getMonth()]}`

    parts.push(`\nПРОГРЕСС ЦЕЛЕЙ:`)
    parts.push(`• Неделя: ${gp.weekCompleted}/${gp.weekTotal} выполнено (конец недели: ${endOfWeekStr}, осталось дней не считая сегодня: ${gp.daysLeftInWeek})`)
    parts.push(`• Месяц: ${gp.monthCompleted}/${gp.monthTotal} выполнено (последний день месяца: ${lastDayOfMonthStr}, осталось дней не считая сегодня: ${gp.daysLeftInMonth})`)
    
    // Предупреждения
    if (gp.weekTotal > 0 && gp.weekCompleted < gp.weekTotal && gp.daysLeftInWeek <= 2) {
      parts.push(`ВНИМАНИЕ: До конца недели (${endOfWeekStr}) осталось ${gp.daysLeftInWeek} дней, а ${gp.weekTotal - gp.weekCompleted} целей ещё не выполнено!`)
    }
    if (gp.monthTotal > 0 && gp.monthCompleted < gp.monthTotal && gp.daysLeftInMonth <= 5) {
      parts.push(`ВНИМАНИЕ: До конца месяца (${lastDayOfMonthStr}) осталось ${gp.daysLeftInMonth} дней, а ${gp.monthTotal - gp.monthCompleted} целей ещё не выполнено!`)
    }
  }

  // История план/факт
  if (request.dayHistory && request.dayHistory.length > 0) {
    parts.push(`\nИСТОРИЯ ПОСЛЕДНИХ ДНЕЙ:`)
    
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
      parts.push(`Средний % выполнения за период: ${avgPct}%`)
      
      if (avgPct < 50) {
        parts.push(`Пользователь систематически выполняет меньше половины плана!`)
      } else if (avgPct < 70) {
        parts.push(`Пользователь выполняет ~${avgPct}% от плана. Возможно, планирует слишком много.`)
      }
    }
  }
  
  // Мечта (показываем первой как главный ориентир)
  parts.push(`\nМЕЧТА ПОЛЬЗОВАТЕЛЯ: ${request.dreamGoal || 'Не указана'}`)
  
  // Цели месяца
  if (request.monthGoals.length > 0) {
    parts.push(`\nЦЕЛИ МЕСЯЦА (${request.monthGoals.length}) — задачи связанные с ними = ОБЯЗАТЕЛЬНЫЕ:`)
    request.monthGoals.forEach((goal, i) => {
      parts.push(`${i + 1}. ${goal}`)
    })
  }
  
  // Цели недели
  if (request.weekGoals.length > 0) {
    parts.push(`\nЦЕЛИ НЕДЕЛИ (${request.weekGoals.length}) — задачи связанные с ними = ВАЖНЫЕ:`)
    request.weekGoals.forEach((goal, i) => {
      parts.push(`${i + 1}. ${goal}`)
    })
  }
  
  // Напоминание о связях
  if (request.monthGoals.length > 0 || request.weekGoals.length > 0) {
    parts.push(`\nВАЖНО: Перед приоритизацией ПРОВЕРЬ связь каждой задачи с целями выше!`)
  }
  
  // План дня
  if (request.planTasks.length > 0) {
    parts.push(`\nПЛАН НА ДЕНЬ (${request.planTasks.length} задач):`)
    request.planTasks.forEach((task, i) => {
      const isCompleted = request.completedTasks.includes(task)
      parts.push(`${i + 1}. ${isCompleted ? '[выполнено]' : '[не выполнено]'} ${task}`)
    })
  } else {
    parts.push(`\nПЛАН НА ДЕНЬ: пусто`)
  }
  
  // Статистика выполнения
  if (request.planTasks.length > 0) {
    const completed = request.completedTasks.length
    const total = request.planTasks.length
    const percent = Math.round((completed / total) * 100)
    parts.push(`\nВЫПОЛНЕНО СЕГОДНЯ: ${completed}/${total} (${percent}%)`)
  }
  
  return parts.join('\n')
}
