import { prisma } from '@/lib/prisma'
import { safeParseJson } from '@/lib/api-utils'
import { getPeriodGoalTexts } from '@/lib/period-goals'

type UserProfileRecord = {
  name: string | null
  occupation: string | null
  industry: string | null
  maritalStatus: string | null
  hobbies: string | null
  sports: string | null
  location: string | null
  age: number | null
  education: string | null
  teamSize: number | null
  workExperience: string | null
  values: string | null
  challenges: string | null
  other: string | null
}

type UserInsightsRecord = {
  patterns: string | null
  strengths: string | null
  challenges: string | null
  preferences: string | null
  recommendations: string | null
  motivators: string | null
  evaluationCount: number
}

type DreamRecord = {
  goalText: string
  months: number | null
} | null

type GoalsJsonRecord = {
  goalsJson: unknown
} | null

export type AiUserProfile = ReturnType<typeof mapUserProfile>
export type AiUserInsights = ReturnType<typeof mapUserInsights>

export type AiGoalsContext = {
  dreamGoal: string
  dreamYears?: number
  dreamMonths?: number
  yearGoals: string[]
  halfYearGoals: string[]
  quarterGoals: string[]
  monthGoals: string[]
  weekGoals: string[]
}

export type AiPlanContext = {
  dreamGoal: string
  weekGoals: string[]
  monthGoals: string[]
  profile: AiUserProfile
  insights: AiUserInsights
}

export type AiEvaluationContext = {
  goals: AiGoalsContext
  profile: AiUserProfile
}

export function mapUserProfile(userProfile: UserProfileRecord | null | undefined) {
  if (!userProfile) return undefined

  return {
    name: userProfile.name || undefined,
    occupation: userProfile.occupation || undefined,
    industry: userProfile.industry || undefined,
    maritalStatus: userProfile.maritalStatus || undefined,
    hobbies: userProfile.hobbies || undefined,
    sports: userProfile.sports || undefined,
    location: userProfile.location || undefined,
    age: userProfile.age || undefined,
    education: userProfile.education || undefined,
    teamSize: userProfile.teamSize || undefined,
    workExperience: userProfile.workExperience || undefined,
    values: userProfile.values || undefined,
    challenges: userProfile.challenges || undefined,
    other: userProfile.other || undefined,
  }
}

export function mapUserInsights(userInsights: UserInsightsRecord | null | undefined) {
  if (!userInsights) return undefined

  return {
    patterns: userInsights.patterns,
    strengths: userInsights.strengths,
    challenges: userInsights.challenges,
    preferences: userInsights.preferences,
    recommendations: userInsights.recommendations,
    motivators: userInsights.motivators,
    evaluationCount: userInsights.evaluationCount,
  }
}

export function buildGoalsContext(params: {
  dream: DreamRecord
  currentYearGoal: GoalsJsonRecord
  halfYearGoals: GoalsJsonRecord
  quarterGoals: GoalsJsonRecord
  monthGoals: GoalsJsonRecord
  weekGoals: GoalsJsonRecord
}): AiGoalsContext {
  const { dream, currentYearGoal, halfYearGoals, quarterGoals, monthGoals, weekGoals } = params

  return {
    dreamGoal: dream?.goalText || 'Не указана',
    dreamYears: dream?.months ? Math.ceil(dream.months / 12) : undefined,
    dreamMonths: dream?.months || undefined,
    yearGoals: safeParseJson(currentYearGoal?.goalsJson, []),
    halfYearGoals: safeParseJson(halfYearGoals?.goalsJson, []),
    quarterGoals: safeParseJson(quarterGoals?.goalsJson, []),
    monthGoals: safeParseJson(monthGoals?.goalsJson, []),
    weekGoals: safeParseJson(weekGoals?.goalsJson, []),
  }
}

export function buildPlanContext(params: {
  dream: DreamRecord
  weekGoalsRecord: GoalsJsonRecord
  monthGoalsRecord: GoalsJsonRecord
  userProfile: UserProfileRecord | null
  userInsights: UserInsightsRecord | null
}): AiPlanContext {
  const { dream, weekGoalsRecord, monthGoalsRecord, userProfile, userInsights } = params

  return {
    dreamGoal: dream?.goalText || 'Не указана',
    weekGoals: safeParseJson(weekGoalsRecord?.goalsJson, []),
    monthGoals: safeParseJson(monthGoalsRecord?.goalsJson, []),
    profile: mapUserProfile(userProfile),
    insights: mapUserInsights(userInsights),
  }
}

export async function getLatestDreamGoal(userId: string) {
  return prisma.dreamGoal.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getLatestUserProfile(userId: string) {
  const userProfile = await prisma.userProfile.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  return mapUserProfile(userProfile)
}

export async function getPlanUserContext(userId: string, targetDate: Date): Promise<AiPlanContext> {
  const [dream, weekTexts, monthTexts, userProfile, userInsights] = await Promise.all([
    getLatestDreamGoal(userId),
    getPeriodGoalTexts(userId, 'week', targetDate),
    getPeriodGoalTexts(userId, 'month', targetDate),
    prisma.userProfile.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.userInsights.findFirst({ where: { userId } }),
  ])

  return buildPlanContext({
    dream,
    weekGoalsRecord: { goalsJson: weekTexts },
    monthGoalsRecord: { goalsJson: monthTexts },
    userProfile,
    userInsights,
  })
}

export async function getDailyEvaluationUserContext(userId: string, date: Date): Promise<AiEvaluationContext> {
  const [goals, userProfile] = await Promise.all([
    getDailyEvaluationGoalsContext(userId, date),
    prisma.userProfile.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
  ])

  return {
    goals,
    profile: mapUserProfile(userProfile),
  }
}

export async function getDailyEvaluationGoalsContext(
  userId: string,
  date: Date,
  dreamOverride?: DreamRecord
): Promise<AiGoalsContext> {
  const year = date.getFullYear()

  const [dream, currentYearGoal, halfYearTexts, quarterTexts, monthTexts, weekTexts] = await Promise.all([
    dreamOverride !== undefined ? Promise.resolve(dreamOverride) : getLatestDreamGoal(userId),
    prisma.yearGoal.findFirst({ where: { userId, year } }),
    getPeriodGoalTexts(userId, 'half_year', date),
    getPeriodGoalTexts(userId, 'quarter', date),
    getPeriodGoalTexts(userId, 'month', date),
    getPeriodGoalTexts(userId, 'week', date),
  ])

  return buildGoalsContext({
    dream,
    currentYearGoal,
    halfYearGoals: { goalsJson: halfYearTexts },
    quarterGoals: { goalsJson: quarterTexts },
    monthGoals: { goalsJson: monthTexts },
    weekGoals: { goalsJson: weekTexts },
  })
}

export async function getPeriodEvaluationUserContext(userId: string, startDate: Date): Promise<AiEvaluationContext> {
  const year = startDate.getFullYear()

  const [dream, currentYearGoal, halfYearTexts, quarterTexts, monthTexts, weekTexts, userProfile] = await Promise.all([
    getLatestDreamGoal(userId),
    prisma.yearGoal.findFirst({ where: { userId, year } }),
    getPeriodGoalTexts(userId, 'half_year', startDate),
    getPeriodGoalTexts(userId, 'quarter', startDate),
    getPeriodGoalTexts(userId, 'month', startDate),
    getPeriodGoalTexts(userId, 'week', startDate),
    prisma.userProfile.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
  ])

  return {
    goals: buildGoalsContext({
      dream,
      currentYearGoal,
      halfYearGoals: { goalsJson: halfYearTexts },
      quarterGoals: { goalsJson: quarterTexts },
      monthGoals: { goalsJson: monthTexts },
      weekGoals: { goalsJson: weekTexts },
    }),
    profile: mapUserProfile(userProfile),
  }
}

export async function getForecastHorizonGoals(options: {
  userId: string
  forecastHorizon: 'week' | 'month' | 'quarter' | 'year' | 'dream'
  horizonStartDate?: Date
}): Promise<string[]> {
  const { userId, forecastHorizon, horizonStartDate } = options

  if (forecastHorizon === 'dream') {
    const currentYear = new Date().getFullYear()
    const yearGoal = await prisma.yearGoal.findFirst({ where: { userId, year: currentYear } })
    return safeParseJson(yearGoal?.goalsJson, [])
  }

  if (!horizonStartDate) return []

  if (forecastHorizon === 'year') {
    const yearGoal = await prisma.yearGoal.findFirst({
      where: { userId, year: horizonStartDate.getFullYear() },
    })
    return safeParseJson(yearGoal?.goalsJson, [])
  }

  return getPeriodGoalTexts(userId, forecastHorizon, horizonStartDate)
}