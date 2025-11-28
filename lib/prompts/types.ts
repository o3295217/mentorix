// Типы для системы оценки

export interface UserProfile {
  name?: string
  occupation?: string
  industry?: string
  maritalStatus?: string
  hobbies?: string
  sports?: string
  location?: string
  age?: number
  education?: string
  teamSize?: number
  workExperience?: string
  values?: string
  challenges?: string
  other?: string
}

export interface GoalsHierarchy {
  dreamGoal: string
  yearGoals: string[]
  halfYearGoals: string[]
  quarterGoals: string[]
  monthGoals: string[]
  weekGoals: string[]
}

export interface DailyContext {
  emotionalState?: string
  physicalState?: string
  lifeEvents?: string
  externalFactors?: string
  energyLevel?: number
  sleepQuality?: number
  familyTime?: number
  exerciseTime?: number
}

export interface AlignmentChain {
  day_to_week: string
  week_to_month: string
  month_to_quarter: string
  quarter_to_half: string
  half_to_year: string
  year_to_dream: string
}

export interface BalanceFlags {
  health: 'норма' | 'внимание' | 'критично'
  family: 'норма' | 'внимание' | 'критично'
  energy: 'норма' | 'внимание' | 'критично'
}

export interface HorizontalAlignment {
  work_health: 'баланс' | 'частично' | 'конфликт' | 'критично'
  work_family: 'баланс' | 'частично' | 'конфликт' | 'критично'
  work_values: 'баланс' | 'частично' | 'конфликт' | 'критично'
}

// Предложенная задача от ИИ
export interface SuggestedTask {
  taskText: string
  taskType: 'strategic' | 'operational'
  priority: 'high' | 'medium' | 'low'
  reason: string // Почему эта задача важна
}

// Ответ для дневной оценки
export interface DailyEvaluationResponse {
  dream_progress_score: number // 1-10
  strategy_score: number
  operations_score: number
  team_score: number
  efficiency_score: number
  overall_score: number
  plan_vs_fact: string
  alignment: AlignmentChain
  balance_flags: BalanceFlags
  horizontal_alignment?: HorizontalAlignment
  feedback: string
  recommendations: string
  suggested_tasks?: SuggestedTask[] // Предложенные задачи
}

// Запрос для дневной оценки
export interface DailyEvaluationRequest {
  date: string
  planText: string
  factText: string
  goals: GoalsHierarchy
  userProfile?: UserProfile
  context?: DailyContext
  openTasks: string[]
}

// === ПЕРИОДИЧЕСКИЕ ОЦЕНКИ ===

// Данные одного дня для периодической оценки
export interface DayData {
  date: string
  planText: string
  factText: string
  dreamProgressScore: number
  overallScore: number
  strategyScore: number
  operationsScore: number
  teamScore: number
  efficiencyScore: number
  healthFlag?: string
  familyFlag?: string
  energyFlag?: string
}

// Запрос для периодической оценки
export interface PeriodEvaluationRequest {
  periodType: 'week' | 'month' | 'quarter' | 'year' | 'custom'
  periodStart: string
  periodEnd: string
  days: DayData[] // Все дни периода с оценками
  goals: GoalsHierarchy
  userProfile?: UserProfile
}

// Паттерны поведения
export interface BehaviorPatterns {
  bestDays: string[] // Дни недели с лучшей эффективностью
  worstDays: string[] // Дни с худшей эффективностью
  productivityPattern: string // Описание паттерна продуктивности
  balanceIssues: string[] // Проблемы с балансом
}

// Тренды
export interface Trends {
  dreamProgressTrend: 'растет' | 'стабильно' | 'падает'
  overallTrend: 'растет' | 'стабильно' | 'падает'
  strategyTrend: 'растет' | 'стабильно' | 'падает'
  description: string
}

// Выполнение целей периода
export interface GoalsCompletion {
  totalGoals: number
  completedGoals: number
  inProgressGoals: number
  notStartedGoals: number
  completionRate: number // %
  analysis: string
}

// Блокеры
export interface Blockers {
  strategic: string[] // Стратегические блокеры
  operational: string[] // Операционные блокеры
  personal: string[] // Личные (здоровье, энергия)
}

// Ответ периодической оценки
export interface PeriodEvaluationResponse {
  dreamProgressScore: number // Средний за период
  overallScore: number // Средний за период

  // Блоки оценки (упрощенная структура для JSON)
  professionalBlock: {
    strategyAvg: number
    operationsAvg: number
    teamAvg: number
    analysis: string
  }
  personalBlock: {
    healthScore: number // 1-10
    familyScore: number // 1-10
    energyScore: number // 1-10
    analysis: string
  }
  socialBlock: {
    teamworkScore: number
    analysis: string
  }
  balanceBlock: {
    workLifeBalance: number // 1-10
    riskOfBurnout: 'низкий' | 'средний' | 'высокий' | 'критичный'
    analysis: string
  }

  patterns: BehaviorPatterns
  trends: Trends
  goalsCompletion: GoalsCompletion
  alignment: string // Детальный alignment анализ
  blockers?: Blockers

  feedback: string // 3-4 абзаца обратной связи
  recommendations: string // Конкретные рекомендации на следующий период
  insights?: string // Глубокие инсайты (для долгосрочных периодов)
}

// === ПРОГНОЗЫ ===

// Запрос для прогноза
export interface ForecastRequest {
  forecastType: 'current_period' | 'dream_achievement' | 'comprehensive'
  periodType?: 'week' | 'month' | 'quarter' | 'year' // Для прогноза текущего периода
  historicalDays: DayData[] // История для анализа
  currentPeriodGoals?: string[] // Цели текущего периода
  dreamGoal: string
  dreamYears: number // Сколько лет на мечту
  userProfile?: UserProfile
}

// Прогноз выполнения целей текущего периода
export interface CurrentPeriodForecast {
  periodType: string
  completionProbability: number // % вероятность выполнения всех целей
  expectedCompletionRate: number // % ожидаемое выполнение
  daysRemaining: number
  currentPace: 'отстает' | 'в темпе' | 'опережает'
  recommendations: string[]
}

// Прогноз достижения мечты
export interface DreamAchievementForecast {
  estimatedYears: number // Сколько лет до мечты при текущем темпе
  onTrack: boolean // Идет ли по плану (в пределах запланированных лет)
  dreamProgressRate: number // % прогресса в год при текущем темпе
  adjustmentNeeded: string // Что нужно изменить
}

// Сценарий "что если"
export interface WhatIfScenario {
  scenario: string // Описание сценария
  impact: string // Влияние
  probability: 'низкая' | 'средняя' | 'высокая'
}

// Комплексный ответ прогноза
export interface ForecastResponse {
  currentPeriodForecast?: CurrentPeriodForecast
  dreamForecast: DreamAchievementForecast
  whatIfScenarios: WhatIfScenario[]
  keyRecommendations: string[] // 3-5 главных рекомендаций
  summary: string // Краткое резюме прогноза
}
