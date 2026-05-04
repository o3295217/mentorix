// Типы для API-ответов (фронтенд)

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

// === МЕЧТА ===
export interface DreamGoal {
  id: number
  goalText: string
  months: number | null
  createdAt: string
  updatedAt: string
}

// === ОЦЕНКА ДНЯ ===
export interface Evaluation {
  id: number
  dailyEntryId: number
  dreamProgressScore: number
  strategicFocusScore: number
  productivityScore: number
  lifeBalanceScore: number
  disciplineScore: number
  overallScore: number
  feedbackText: string
  planVsFactText: string
  alignmentDayWeek: string
  alignmentWeekMonth: string
  alignmentMonthQuarter: string
  alignmentQuarterHalf: string
  alignmentHalfYear: string
  alignmentYearDream: string
  recommendationsText: string
  healthFlag?: string
  familyFlag?: string
  energyFlag?: string
  workHealthAlignment?: string
  workFamilyAlignment?: string
  workValuesAlignment?: string
  suggestedTasksJson?: unknown
  createdAt: string
}

// === ЕЖЕДНЕВНАЯ ЗАПИСЬ ===
export interface DailyEntry {
  id: number
  date: string
  planText?: string
  factText?: string
  planSnapshotJson?: unknown
  extraTasksJson?: unknown
  emotionalState?: string
  physicalState?: string
  lifeEvents?: string
  externalFactors?: string
  energyLevel?: number
  sleepQuality?: number
  familyTime?: number
  exerciseTime?: number
  selectedTasksJson?: unknown
  createdAt: string
  updatedAt: string
  evaluation?: Evaluation
}

// === СТАТИСТИКА ПРОГРЕССА ===
export interface ProgressStats {
  currentSpeed: number
  totalDays: number
  effectiveDays: number
  elapsedDays: number
  plannedDays: number
  evaluatedDays: number
  currentStreak: number
  longestStreak: number
  avgSpeed30d: number
  fuelLevel: number
  milestones: {
    '10': boolean
    '30': boolean
    '100': boolean
    '365': boolean
    '1000': boolean
  }
  progressPercent: number
  targetDays: number | null
  last30DaysData?: Array<{ date: string; score: number }>
  distribution: {
    excellent: number
    medium: number
    poor: number
  }
}

export interface DreamProgressSummary {
  total: number
  completed: number
  percent: number
}

export interface GoalsContextResponse {
  dreamGoal: DreamGoal | null
  activeYears: number[]
  archivedYearGoalYears: number[]
  yearGoals: Record<string, YearGoalItem[]>
  periodGoals: Record<string, string[]>
  goals: Goal[]
  tags: GoalTag[]
  dreamProgress: DreamProgressSummary
  yearEvaluations: Record<string, { avg: number; count: number }>
}

// === ЭЛЕМЕНТ ГОДОВОЙ ЦЕЛИ ===
export interface YearGoalItem {
  id: string
  text: string
}

// === ЦЕЛИ НА ПЕРИОД ===
export interface PeriodGoals {
  goals: string[]
}

// === ЗАДАЧА ===
export interface Task {
  id: string
  text: string
}

// === ОТКРЫТАЯ ЗАДАЧА ===
export interface OpenTask {
  id: number
  taskText: string
  taskType: 'strategic' | 'operational' | 'personal'
  originDate: string
  isClosed: boolean
  archiveStatus?: 'completed' | 'paused' | null
  closedAt?: string
  createdAt: string
}

// === ПРЕДЛОЖЕННАЯ ЗАДАЧА (от ИИ) ===
export interface SuggestedTask {
  taskText: string
  taskType: 'strategic' | 'operational'
  priority: 'high' | 'medium' | 'low'
  reason: string
}

// === ДАННЫЕ ДЛЯ ГРАФИКА ТРЕНДОВ ===
export interface TrendDataPoint {
  date: string
  overallScore: number
  dreamProgressScore: number
  strategicFocusScore: number
  productivityScore: number
  lifeBalanceScore: number
  disciplineScore: number
}

// === СТАТИСТИКА ДЛЯ АНАЛИТИКИ ===
export interface AnalyticsStats {
  avg: number
  max: number
  min: number
  topDays: TrendDataPoint[]
  worstDays: TrendDataPoint[]
}

// === ЦЕЛИ ===
export interface Goal {
  id: number
  text: string
  periodType: string
  periodKey: string
  completed: boolean
  completedAt: string | null
  deadline: string | null
  priority: number // 0=нет, 1=низкий, 2=средний, 3=высокий
  tags: string[]
  blockedBy: number[]
  history: { action: string; date: string; from?: string; to?: string }[]
  sortOrder: number
  scope: string | null
  rootYearGoalId: string | null
  parentId: number | null
  children?: Goal[]
  createdAt: string
  updatedAt: string
}

// === ТЕГ ЦЕЛИ ===
export interface GoalTag {
  id: number
  name: string
  color: string
}
