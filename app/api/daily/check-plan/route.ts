import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { getPeriodDates, parseDateParam, toDateKey } from '@/lib/dates'
import { buildFactFromSelection, splitLines } from '@/lib/fact-utils'
import { safeParseJson } from '@/lib/api-utils'
import {
  CHECK_PLAN_SYSTEM_PROMPT,
  buildCheckPlanPrompt,
  CheckPlanRequest,
  CheckPlanResponse
} from '@/lib/prompts/check-plan'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 2,
  timeout: 60 * 1000, // 1 minute timeout
})

const CheckPlanSchema = z.object({
  date: z.string(),
  planTasks: z.array(z.string()),
})

// Получить день недели на русском
function getDayOfWeek(dateStr: string): string {
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
  const date = parseDateParam(dateStr)
  return days[date.getDay()]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const validation = CheckPlanSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { date, planTasks } = validation.data
    const targetDate = parseDateParam(date)

    // Получить мечту
    const dream = await prisma.dreamGoal.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    // Получить цели недели и месяца
    const weekPeriod = getPeriodDates(targetDate, 'week')
    const monthPeriod = getPeriodDates(targetDate, 'month')

    const [weekGoalsRecord, monthGoalsRecord] = await Promise.all([
      prisma.periodGoal.findFirst({
        where: { periodType: 'week', periodStart: weekPeriod.start },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.periodGoal.findFirst({
        where: { periodType: 'month', periodStart: monthPeriod.start },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const weekGoals = safeParseJson<string[]>(weekGoalsRecord?.goalsJson, [])
    const monthGoals = safeParseJson<string[]>(monthGoalsRecord?.goalsJson, [])

    // Получить историю за последние 7 дней
    const historyStart = new Date(targetDate)
    historyStart.setDate(historyStart.getDate() - 7)
    
    const recentEntries = await prisma.dailyEntry.findMany({
      where: {
        date: {
          gte: historyStart,
          lt: targetDate,
        },
      },
      orderBy: { date: 'desc' },
      take: 5,
    })

    const recentHistory = recentEntries.map(entry => {
      const planLines = splitLines(entry.planText)
      const { completedTasks } = buildFactFromSelection({
        planText: entry.planText,
        factText: entry.factText,
        selectedTasksJson: entry.selectedTasksJson,
      })
      return {
        date: toDateKey(entry.date),
        planTasks: planLines,
        completedTasks,
      }
    })

    // Получить профиль пользователя и insights
    const [userProfile, userInsights] = await Promise.all([
      prisma.userProfile.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.userInsights.findFirst(),
    ])

    // Построить запрос
    const checkRequest: CheckPlanRequest = {
      date,
      dayOfWeek: getDayOfWeek(date),
      planTasks,
      weekGoals,
      monthGoals,
      dreamGoal: dream?.goalText || 'Не указана',
      recentHistory,
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

    const userPrompt = buildCheckPlanPrompt(checkRequest)

    // Вызов Claude API
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',  // Haiku для проверки плана - дешевле
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: CHECK_PLAN_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Извлечение JSON из ответа
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('Claude response without JSON:', responseText)
      return NextResponse.json(
        { error: 'Failed to parse response from Claude' },
        { status: 500 }
      )
    }

    let parsedResponse: CheckPlanResponse
    try {
      parsedResponse = JSON.parse(jsonMatch[0])
    } catch {
      console.error('Invalid JSON from Claude:', jsonMatch[0])
      return NextResponse.json(
        { error: 'Claude returned invalid JSON' },
        { status: 500 }
      )
    }

    // Логирование
    console.log('[Check Plan] Response:', {
      overall: parsedResponse.overall,
      suggestionsCount: parsedResponse.suggestions?.length || 0,
      warningsCount: parsedResponse.warnings?.length || 0,
    })

    return NextResponse.json(parsedResponse)
  } catch (error) {
    console.error('Error checking plan:', error)
    return NextResponse.json(
      { error: 'Failed to check plan' },
      { status: 500 }
    )
  }
}
