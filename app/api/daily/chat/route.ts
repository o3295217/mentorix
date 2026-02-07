import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { getPeriodDates, parseDateParam, toDateKey } from '@/lib/dates'
import { safeParseJson } from '@/lib/api-utils'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import {
  PLAN_CHAT_SYSTEM_PROMPT,
  buildPlanChatContext,
  PlanChatRequest,
  DayHistory,
  GoalsProgress,
} from '@/lib/prompts/plan-chat'
import { getUserStatsForAI } from '@/lib/user-stats'
import { requireUserId } from '@/lib/get-user-id'
import { logAIUsage } from '@/lib/ai-usage'

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
  try {
    const userId = await requireUserId(request)

    // Rate limiting by userId (not spoofable IP)
    const rateLimit = checkRateLimit(userId, rateLimiters.ai)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before sending another message.', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }
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
      prisma.dreamGoal.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.periodGoal.findFirst({
        where: { userId, periodType: 'week', periodStart: weekPeriod.start },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.periodGoal.findFirst({
        where: { userId, periodType: 'month', periodStart: monthPeriod.start },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.userProfile.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.userInsights.findFirst({ where: { userId } }),
      // История план/факт за последние 14 дней
      prisma.dailyEntry.findMany({
        where: {
          userId,
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
          userId,
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
      getUserStatsForAI(userId),
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
    
    // Формируем секцию плана
    const planSection = planTasks.length > 0 
      ? `📋 ТЕКУЩИЙ ПЛАН НА ДЕНЬ (${planTasks.length} задач):\n${planTasks.map((t, i) => `${i + 1}. ${completedTasks.includes(t) ? '✅' : '☐'} ${t}`).join('\n')}`
      : '📋 ПЛАН НА ДЕНЬ: пусто'
    
    // Определяем, нужно ли показывать план
    // План показываем если пользователь просит его посмотреть или это первое сообщение
    const planKeywords = ['план', 'задач', 'посмотри', 'смотри', 'анализ', 'проверь', 'оцен', 'что сегодня', 'что делать', 'что у меня', 'покажи']
    const needPlan = messages.length === 0 || planKeywords.some(kw => userMessage.toLowerCase().includes(kw))
    
    // Логирование для отладки
    console.log(`[Plan Chat] Date: ${date}, Tasks: ${planTasks.length}, Completed: ${completedTasks.length}, History: ${messages.length}`)
    console.log(`[Plan Chat] Task list: ${planTasks.join(' | ').substring(0, 200)}`)
    console.log(`[Plan Chat] Need plan context: ${needPlan}, User message: "${userMessage.substring(0, 50)}"`)

    // Собрать историю сообщений для Claude
    const claudeMessages: { role: 'user' | 'assistant'; content: string }[] = []
    
    // Добавить историю сообщений как есть
    for (const msg of messages) {
      claudeMessages.push({
        role: msg.role,
        content: msg.content,
      })
    }
    
    // Формируем сообщение пользователя
    // Если нужен план — добавляем его к сообщению
    const userContent = needPlan 
      ? `${planSection}\n\n---\n\n${userMessage}`
      : userMessage
    
    claudeMessages.push({
      role: 'user',
      content: userContent,
    })
    
    // Claude требует чередование user/assistant, исправляем если нужно
    // Если два user подряд — объединяем
    const fixedMessages: { role: 'user' | 'assistant'; content: string }[] = []
    for (const msg of claudeMessages) {
      const last = fixedMessages[fixedMessages.length - 1]
      if (last && last.role === msg.role) {
        // Объединяем сообщения одной роли
        last.content += '\n\n' + msg.content
      } else {
        fixedMessages.push({ ...msg })
      }
    }
    
    // Если первое сообщение не user — добавляем пустое user
    if (fixedMessages.length > 0 && fixedMessages[0].role === 'assistant') {
      fixedMessages.unshift({ role: 'user', content: 'Привет' })
    }

    // Вызов Claude API
    const startTime = Date.now()
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',  // Haiku для чата - дешевле
      max_tokens: 1024,
      system: [
        {
          // Статический промпт - кешируется
          type: 'text',
          text: PLAN_CHAT_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
        {
          // Динамический контекст - не кешируется (меняется каждый день)
          type: 'text',
          text: `\n---\n\n${context}`,
        },
      ],
      messages: fixedMessages,
    })
    const durationMs = Date.now() - startTime

    // Логируем использование AI
    await logAIUsage({
      userId,
      endpoint: 'chat',
      model: 'claude-3-5-haiku-20241022',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      success: true,
    })

    const assistantMessage = response.content[0].type === 'text' 
      ? response.content[0].text 
      : ''

    console.log('[Plan Chat] Response length:', assistantMessage.length)

    // Сохраняем оба сообщения в БД
    try {
      await prisma.chatMessage.createMany({
        data: [
          { userId, date, role: 'user', content: userMessage },
          { userId, date, role: 'assistant', content: assistantMessage },
        ],
      })
    } catch (saveError) {
      console.error('[Plan Chat] Failed to save messages to DB:', saveError)
      // Не блокируем ответ если сохранение не удалось
    }

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
