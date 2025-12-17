import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { getPeriodDates, parseDateParam } from '@/lib/dates'
import { safeParseJson } from '@/lib/api-utils'
import {
  PLAN_CHAT_SYSTEM_PROMPT,
  buildPlanChatContext,
  PlanChatRequest,
} from '@/lib/prompts/plan-chat'

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

export async function POST(request: NextRequest) {
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

    // Получить контекст (мечта, цели, профиль, insights)
    const [dream, weekGoalsRecord, monthGoalsRecord, userProfile, userInsights] = await Promise.all([
      prisma.dreamGoal.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.periodGoal.findFirst({
        where: { periodType: 'week', periodStart: getPeriodDates(targetDate, 'week').start },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.periodGoal.findFirst({
        where: { periodType: 'month', periodStart: getPeriodDates(targetDate, 'month').start },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.userProfile.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.userInsights.findFirst(), // Профиль понимания пользователя
    ])

    const weekGoals = safeParseJson<string[]>(weekGoalsRecord?.goalsJson, [])
    const monthGoals = safeParseJson<string[]>(monthGoalsRecord?.goalsJson, [])

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
