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
  uncompletedTasks?: string[] // Задачи из плана, которые НЕ были выполнены
  extraTasks?: string[]
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

// Данные дня с полным анализом план/факт
export interface DayDataFull extends DayData {
  tasksPlanned: number      // Сколько задач запланировано
  tasksCompleted: number    // Сколько выполнено
  strategicTasks: number    // Стратегических задач
  strategicCompleted: number // Выполнено стратегических
}

// Анализ качества выполнения за базовый период
export interface ExecutionQuality {
  totalTasksPlanned: number
  totalTasksCompleted: number
  completionRate: number // %
  strategicTasksPlanned: number
  strategicTasksCompleted: number
  strategicCompletionRate: number // %
  avgDreamProgress: number
  avgOverallScore: number
  trend: 'растет' | 'стабильно' | 'падает'
  patterns: string[] // Выявленные паттерны поведения
}

// Запрос для прогноза (НОВАЯ ЛОГИКА)
export interface ForecastRequest {
  // 1. БАЗА ДЛЯ АНАЛИЗА (прошлое)
  basePeriodType: 'week' | 'month' | 'quarter' | 'year' | 'custom'
  basePeriodStart: string
  basePeriodEnd: string
  baseDays: DayDataFull[] // Дни базового периода с план/факт
  
  // 2. ГОРИЗОНТ ПРОГНОЗА (будущее)
  forecastHorizon: 'week' | 'month' | 'quarter' | 'year' | 'dream'
  horizonGoals: string[] // Цели горизонта
  horizonStart?: string
  horizonEnd?: string
  
  // Контекст
  dreamGoal: string
  dreamYears: number
  userProfile?: UserProfile
}

// Прогноз по конкретной цели
export interface GoalForecast {
  goal: string
  probability: number // % вероятность выполнения
  risk: 'низкий' | 'средний' | 'высокий'
  threats: string[] // Что угрожает выполнению
  recommendation: string
}

// Паттерны поведения
export interface BehaviorPattern {
  pattern: string // Описание паттерна
  impact: 'позитивный' | 'негативный' | 'нейтральный'
  recommendation?: string
}

// Прогноз достижения мечты (обновленный)
export interface DreamForecast {
  estimatedYears: number
  onTrack: boolean
  progressPerYear: number // % прогресса в год
  requiredProgressPerYear: number // Сколько нужно для достижения вовремя
  gap: number // Разрыв между текущим и требуемым
  adjustmentNeeded: string
}

// Сценарий "что если"
export interface WhatIfScenario {
  scenario: string
  impact: string
  probability: 'низкая' | 'средняя' | 'высокая'
}

// Комплексный ответ прогноза (НОВЫЙ)
export interface ForecastResponse {
  // Анализ базового периода
  executionQuality: ExecutionQuality
  behaviorPatterns: BehaviorPattern[]
  
  // Прогноз по горизонту
  horizonType: string
  goalForecasts: GoalForecast[] // Прогноз по каждой цели
  overallProbability: number // Общая вероятность выполнения целей горизонта
  
  // Прогноз мечты
  dreamForecast: DreamForecast
  
  // Сценарии и рекомендации
  whatIfScenarios: WhatIfScenario[]
  keyRecommendations: string[]
  criticalRisks: string[] // Критические риски
  
  summary: string
}
