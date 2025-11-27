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
  health: 'ok' | 'warning' | 'critical'
  family: 'ok' | 'warning' | 'critical'
  energy: 'ok' | 'warning' | 'critical'
}

export interface HorizontalAlignment {
  work_health: 'works' | 'partial' | 'conflict' | 'critical'
  work_family: 'works' | 'partial' | 'conflict' | 'critical'
  work_values: 'works' | 'partial' | 'conflict' | 'critical'
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
