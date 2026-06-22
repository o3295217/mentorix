import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { parseDateParam, toDateKey } from '@/lib/dates'
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
import { DEFAULT_ROUTE_AI_MODEL, getAiModel, getAnthropicClient } from '@/lib/anthropic'
import { getWorkContextForAI } from '@/lib/completed-work'
import { getPlanUserContext } from '@/lib/user-context'

const ChatSchema = z.object({
  date: z.string().trim().min(1).max(32),
  currentTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), // HH:MM время пользователя
  planTasks: z.array(z.string().trim().min(1).max(500)).max(50),
  completedTasks: z.array(z.string().trim().min(1).max(500)).max(50),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(4000),
  })).max(40),
  userMessage: z.string().trim().min(1).max(4000), // Новое сообщение пользователя
})

// День недели на русском
function getDayOfWeek(dateStr: string): string {
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
  const date = parseDateParam(dateStr)
  return days[date.getDay()]
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

    const { date, currentTime, planTasks, completedTasks, messages, userMessage } = validation.data
    const targetDate = parseDateParam(date)

    // Даты для выборки истории (последние 14 дней)
    const historyStartDate = new Date(targetDate)
    historyStartDate.setDate(historyStartDate.getDate() - 14)
    
    // Получить контекст (мечта, цели, профиль, insights, история, прогресс целей, статистика, кэш знаний)
    const [
      planContext,
      recentEntries,
      trackedGoals,
      cumulativeStats,
      knowledgeCache,
      workContext,
    ] = await Promise.all([
      getPlanUserContext(userId, targetDate),
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
      // Накопленные наблюдения (кэш знаний)
      prisma.insightEntry.findMany({
        where: { userId },
        select: { date: true, category: true, text: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      // Контекст фактически выполненной работы
      getWorkContextForAI(userId, targetDate),
    ])

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
      weekTotal: planContext.weekGoals.length,
      weekCompleted: weekTracked.filter((g: TrackedGoal) => g.completed).length,
      monthTotal: planContext.monthGoals.length,
      monthCompleted: monthTracked.filter((g: TrackedGoal) => g.completed).length,
      daysLeftInWeek: getDaysLeftInWeek(targetDate),
      daysLeftInMonth: getDaysLeftInMonth(targetDate),
    }

    // Построить контекст для ИИ
    const chatRequest: PlanChatRequest = {
      date,
      dayOfWeek: getDayOfWeek(date),
      currentTime: currentTime || undefined,
      planTasks,
      completedTasks,
      weekGoals: planContext.weekGoals,
      monthGoals: planContext.monthGoals,
      dreamGoal: planContext.dreamGoal,
      messages,
      dayHistory,
      goalsProgress,
      cumulativeStats,
      profile: planContext.profile,
      insights: planContext.insights,
      knowledgeCache,
      workContext,
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
    
    console.log('[Plan Chat] Request summary:', {
      date,
      planTasks: planTasks.length,
      completedTasks: completedTasks.length,
      historyMessages: messages.length,
      needPlan,
    })

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

    // Убираем markdown-форматирование из законченной строки (**, *, #)
    function stripMarkdown(line: string): string {
      return line
        .replace(/\*\*(.+?)\*\*/g, '$1')  // **жирный** → жирный
        .replace(/\*(.+?)\*/g, '$1')       // *курсив* → курсив
        .replace(/^#{1,6}\s+/, '')         // # заголовки → простой текст
    }

    // Вызов Claude API со стримингом — ответ идёт постепенно, без ожидания всего текста
    const startTime = Date.now()
    const model = getAiModel(DEFAULT_ROUTE_AI_MODEL)
    const stream = getAnthropicClient().messages.stream({
      model,
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

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        let assistantMessage = ''
        let lineBuffer = ''
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              lineBuffer += event.delta.text
              const newlineIndex = lineBuffer.lastIndexOf('\n')
              if (newlineIndex !== -1) {
                const completeChunk = stripMarkdown(lineBuffer.slice(0, newlineIndex + 1))
                assistantMessage += completeChunk
                controller.enqueue(encoder.encode(completeChunk))
                lineBuffer = lineBuffer.slice(newlineIndex + 1)
              }
            }
          }
          if (lineBuffer) {
            const tail = stripMarkdown(lineBuffer)
            assistantMessage += tail
            controller.enqueue(encoder.encode(tail))
          }

          const finalMessage = await stream.finalMessage()
          const durationMs = Date.now() - startTime

          await logAIUsage({
            userId,
            endpoint: 'chat',
            model,
            inputTokens: finalMessage.usage.input_tokens,
            outputTokens: finalMessage.usage.output_tokens,
            durationMs,
            success: true,
          })

          console.log('[Plan Chat] Response length:', assistantMessage.length)

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

          controller.close()
        } catch (streamError) {
          console.error('Error in plan chat stream:', streamError)
          controller.error(streamError)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('Error in plan chat:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}
