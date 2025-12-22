import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { getPeriodDates, parseDateParam, toDateKey } from '@/lib/dates'
import { safeParseJson } from '@/lib/api-utils'
import { checkRateLimit, getClientIdentifier, rateLimiters } from '@/lib/rate-limit'
import {
  PLAN_CHAT_SYSTEM_PROMPT,
  buildPlanChatContext,
  PlanChatRequest,
  DayHistory,
  GoalsProgress,
} from '@/lib/prompts/plan-chat'
import { getUserStatsForAI } from '@/lib/user-stats'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 2,
  timeout: 60 * 1000,
})

const ChatSchema = z.object({
  date: z.string(),
  planTasks: z.array(z.string()),
  completedTasks: z.array(z.string()),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
  userMessage: z.string(), // Новое сообщение пользователя
})

// День недели на русском
function getDayOfWeek(dateStr: string): string {
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
  const date = parseDateParam(dateStr)
  return days[date.getDay()]
}

// Номер недели в месяце
function getWeekNumber(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const firstMonday = new Date(firstDay)
  while (firstMonday.getDay() !== 1) firstMonday.setDate(firstMonday.getDate() + 1)
  
  if (date < firstMonday) return 1
  
  const diff = Math.floor((date.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return diff + 1
}

// Дней до конца недели (воскресенья)
function getDaysLeftInWeek(date: Date): number {
  const dayOfWeek = date.getDay()
  return dayOfWeek === 0 ? 0 : 7 - dayOfWeek
}

// Дней до конца месяца
function getDaysLeftInMonth(date: Date): number {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return lastDay.getDate() - date.getDate()
}

export async function POST(request: NextRequest) {
  // Rate limiting for AI endpoints
  const clientId = getClientIdentifier(request)
  const rateLimit = checkRateLimit(clientId, rateLimiters.ai)

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before sending another message.', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    )
  }

  try {
    const body = await request.json()
    
    const validation = ChatSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { date, planTasks, completedTasks, messages, userMessage } = validation.data
    const targetDate = parseDateParam(date)

    // Даты для выборки истории (последние 14 дней)
    const historyStartDate = new Date(targetDate)
    historyStartDate.setDate(historyStartDate.getDate() - 14)
    
    // Даты периодов
    const weekPeriod = getPeriodDates(targetDate, 'week')
    const monthPeriod = getPeriodDates(targetDate, 'month')

    // Получить контекст (мечта, цели, профиль, insights, история, прогресс целей, статистика)
    const [
      dream,
      weekGoalsRecord,
      monthGoalsRecord,
      userProfile,
      userInsights,
      recentEntries,
      trackedGoals,
      cumulativeStats,
    ] = await Promise.all([
      prisma.dreamGoal.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.periodGoal.findFirst({
        where: { periodType: 'week', periodStart: weekPeriod.start },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.periodGoal.findFirst({
        where: { periodType: 'month', periodStart: monthPeriod.start },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.userProfile.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.userInsights.findFirst(),
      // История план/факт за последние 14 дней
      prisma.dailyEntry.findMany({
        where: {
          date: {
            gte: historyStartDate,
            lt: targetDate, // Не включаем текущий день
          },
        },
        select: {
          date: true,
          planText: true,
          factText: true,
          selectedTasksJson: true,
          evaluation: {
            select: {
              overallScore: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        take: 14,
      }),
      // Прогресс целей недели и месяца
      prisma.goal.findMany({
        where: {
          OR: [
            { periodKey: { startsWith: `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-W` } },
            { periodKey: `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}` },
          ],
        },
        select: {
          periodKey: true,
          text: true,
          completed: true,
        },
      }),
      // Накопительная статистика
      getUserStatsForAI(),
    ])

    const weekGoals = safeParseJson<string[]>(weekGoalsRecord?.goalsJson, [])
    const monthGoals = safeParseJson<string[]>(monthGoalsRecord?.goalsJson, [])

    // Типизация для истории
    type RecentEntry = typeof recentEntries[number]
    type TrackedGoal = typeof trackedGoals[number]

    // Подготовить историю план/факт
    const dayHistory: DayHistory[] = recentEntries.map((entry: RecentEntry) => {
      const planLines = entry.planText ? entry.planText.split('\n').filter((l: string) => l.trim()) : []
      const factLines = entry.factText ? entry.factText.split('\n').filter((l: string) => l.trim()) : []
      const selectedIds = safeParseJson<number[]>(entry.selectedTasksJson, [])
      
      return {
        date: toDateKey(entry.date),
        planCount: planLines.length,
        completedCount: selectedIds.length,
        factCount: factLines.length,
        score: entry.evaluation?.overallScore || null,
      }
    })

    // Подготовить прогресс целей
    const weekTracked = trackedGoals.filter((g: TrackedGoal) => g.periodKey.includes('-W'))
    const monthTracked = trackedGoals.filter((g: TrackedGoal) => !g.periodKey.includes('-W'))
    
    const goalsProgress: GoalsProgress = {
      weekTotal: weekGoals.length,
      weekCompleted: weekTracked.filter((g: TrackedGoal) => g.completed).length,
      monthTotal: monthGoals.length,
      monthCompleted: monthTracked.filter((g: TrackedGoal) => g.completed).length,
      daysLeftInWeek: getDaysLeftInWeek(targetDate),
      daysLeftInMonth: getDaysLeftInMonth(targetDate),
    }

    // Построить контекст для ИИ
    const chatRequest: PlanChatRequest = {
      date,
      dayOfWeek: getDayOfWeek(date),
      planTasks,
      completedTasks,
      weekGoals,
      monthGoals,
      dreamGoal: dream?.goalText || 'Не указана',
      messages,
      dayHistory,
      goalsProgress,
      cumulativeStats,
      profile: userProfile ? {
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
      } : undefined,
      insights: userInsights ? {
        patterns: userInsights.patterns,
        strengths: userInsights.strengths,
        challenges: userInsights.challenges,
        preferences: userInsights.preferences,
        recommendations: userInsights.recommendations,
        motivators: userInsights.motivators,
        evaluationCount: userInsights.evaluationCount,
      } : undefined,
    }

    const context = buildPlanChatContext(chatRequest)

    // Собрать историю сообщений для Claude
    const claudeMessages: { role: 'user' | 'assistant'; content: string }[] = []
    
    // Первое сообщение - контекст + первый вопрос или просто контекст
    if (messages.length === 0) {
      // Первое сообщение в чате - добавить контекст
      claudeMessages.push({
        role: 'user',
        content: `${context}\n\n---\n\nСообщение пользователя: ${userMessage}`,
      })
    } else {
      // Есть история - первое сообщение с контекстом, потом история
      claudeMessages.push({
        role: 'user',
        content: `${context}\n\n---\n\nНачало диалога.`,
      })
      
      // Добавить первый ответ ассистента если был
      if (messages.length > 0 && messages[0].role === 'assistant') {
        claudeMessages.push({
          role: 'assistant',
          content: messages[0].content,
        })
      }
      
      // Добавить остальную историю
      for (let i = messages[0]?.role === 'assistant' ? 1 : 0; i < messages.length; i++) {
        claudeMessages.push({
          role: messages[i].role,
          content: messages[i].content,
        })
      }
      
      // Добавить новое сообщение пользователя
      claudeMessages.push({
        role: 'user',
        content: userMessage,
      })
    }

    // Вызов Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',  // Haiku для чата - дешевле
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: PLAN_CHAT_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: claudeMessages,
    })

    const assistantMessage = response.content[0].type === 'text' 
      ? response.content[0].text 
      : ''

    console.log('[Plan Chat] Response length:', assistantMessage.length)

    return NextResponse.json({
      message: assistantMessage,
    })
  } catch (error) {
    console.error('Error in plan chat:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}
