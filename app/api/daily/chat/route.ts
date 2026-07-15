import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { parseDateParam, toDateKey } from '@/lib/dates'
import { safeParseJson, sanitizeUserInput } from '@/lib/api-utils'
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
import { getAiModel, getAnthropicClient } from '@/lib/anthropic'
import { getWorkContextForAI } from '@/lib/completed-work'
import { getPlanUserContext } from '@/lib/user-context'
import { DailyScheduleSchema, hashDailySchedule } from '@/lib/daily-schedule'
import { createProposalMetadata, DailyScheduleProposalSchema, TimezoneSchema, validateProposalAgainstCurrentPlan } from '@/lib/daily-schedule-proposal'

const ChatSchema = z.object({
  date: z.string().trim().min(1).max(32),
  timezone: TimezoneSchema,
  currentTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), // HH:MM время пользователя
  planTasks: z.array(z.string().trim().min(1).max(500)).max(50),
  completedTasks: z.array(z.string().trim().min(1).max(500)).max(50),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(4000),
  })).max(40),
  userMessage: z.string().trim().min(1).max(4000), // Новое сообщение пользователя
})

function sseEvent(type: 'text' | 'proposal' | 'done' | 'error', data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
}

const proposeDailyScheduleTool = {
  name: 'propose_daily_schedule',
  description: 'Предложить расписание дня. Use exactly the timezone provided in the request context; do not guess timezone. Task blocks can only reference existing plan tasks by exact 1-based taskIndex and exact taskText; meal/rest/buffer are service blocks.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['version', 'date', 'timezone', 'dayStartMinutes', 'dayEndMinutes', 'blocks'],
    properties: {
      version: { type: 'integer', const: 1 },
      date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      timezone: { type: 'string', minLength: 1, maxLength: 100, pattern: '^([A-Za-z_]+\\/[A-Za-z0-9_+.-]+(?:\\/[A-Za-z0-9_+.-]+)*|UTC)$', description: 'Must exactly match the timezone value from the request context.' },
      dayStartMinutes: { type: 'integer', minimum: 0, maximum: 1440, multipleOf: 15 },
      dayEndMinutes: { type: 'integer', minimum: 0, maximum: 1440, multipleOf: 15 },
      rationale: { type: 'string', maxLength: 1000 },
      blocks: {
        type: 'array',
        minItems: 1,
        maxItems: 100,
        items: {
          oneOf: [
            {
              type: 'object',
              additionalProperties: false,
              required: ['kind', 'taskIndex', 'taskText', 'startMinutes', 'durationMinutes'],
              properties: {
                kind: { const: 'task' },
                taskIndex: { type: 'integer', minimum: 1 },
                taskText: { type: 'string', minLength: 1, maxLength: 500 },
                startMinutes: { type: 'integer', minimum: 0, maximum: 1440, multipleOf: 15 },
                durationMinutes: { type: 'integer', minimum: 15, maximum: 1440, multipleOf: 15 },
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              required: ['kind', 'title', 'startMinutes', 'durationMinutes'],
              properties: {
                kind: { enum: ['meal', 'rest', 'buffer'] },
                title: { type: 'string', minLength: 1, maxLength: 120 },
                startMinutes: { type: 'integer', minimum: 0, maximum: 1440, multipleOf: 15 },
                durationMinutes: { type: 'integer', minimum: 15, maximum: 1440, multipleOf: 15 },
              },
            },
          ],
        },
      },
    },
  },
}

type StreamEvent = { type?: string; delta?: { type?: string; text?: string; partial_json?: string }; content_block?: { type?: string; id?: string; name?: string; input?: unknown }; index?: number }

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

    const { date, timezone, currentTime, planTasks, completedTasks, messages, userMessage } = validation.data
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
      currentEntry,
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
      prisma.dailyEntry.findFirst({
        where: { userId, date: targetDate },
        select: { schedule: { select: { scheduleJson: true, updatedAt: true } } },
      }),
    ])

    const currentScheduleValidation = currentEntry?.schedule ? DailyScheduleSchema.safeParse(currentEntry.schedule.scheduleJson) : null
    const currentScheduleExists = !!currentEntry?.schedule
    const currentScheduleHash = currentScheduleValidation?.success ? hashDailySchedule(currentScheduleValidation.data) : null
    const scheduleContext = currentEntry?.schedule
      ? `\n\n🗓️ ТЕКУЩЕЕ РАСПИСАНИЕ: есть; updatedAt=${currentEntry.schedule.updatedAt.toISOString()}; hash=${currentScheduleHash ?? 'invalid'}`
      : '\n\n🗓️ ТЕКУЩЕЕ РАСПИСАНИЕ: отсутствует'
    const timezoneContext = `\n\n🌐 TIMEZONE: ${timezone}. Любой вызов propose_daily_schedule обязан использовать ровно это значение proposal.timezone; не угадывай и не заменяй timezone.`

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
    const sanitizedUserMessage = sanitizeUserInput(userMessage, 4000)
    const userContent = needPlan 
      ? `${planSection}\n\n---\n\n${sanitizedUserMessage}`
      : sanitizedUserMessage
    
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

    // Вызов Claude API со стримингом — ответ идёт постепенно, без ожидания всего текста
    const startTime = Date.now()
    // Чат о плане дня — частая простая задача, используем FAST-модель
    const model = getAiModel('fast')
    const stream = getAnthropicClient().messages.stream({
      model,
      max_tokens: 4096,
      tools: [proposeDailyScheduleTool as never],
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
      text: `\n---\n\n${context}${scheduleContext}${timezoneContext}`,
        },
      ],
      messages: fixedMessages,
    })

    const readable = new ReadableStream({
      async start(controller) {
        try {
          let assistantMessage = ''
          const toolInputs = new Map<number, string>()
          const toolNames = new Map<number, string>()

          for await (const rawEvent of stream as AsyncIterable<unknown>) {
            const event = rawEvent as StreamEvent
            if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use' && typeof event.index === 'number') {
              toolNames.set(event.index, event.content_block.name ?? '')
              toolInputs.set(event.index, '')
            }
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
              assistantMessage += event.delta.text
              controller.enqueue(sseEvent('text', { text: event.delta.text }))
            }
            if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta' && typeof event.index === 'number') {
              toolInputs.set(event.index, (toolInputs.get(event.index) ?? '') + (event.delta.partial_json ?? ''))
            }
          }

          const finalMessage = await stream.finalMessage()
          const durationMs = Date.now() - startTime

          let proposalMetadata: ReturnType<typeof createProposalMetadata> | null = null
          for (const [index, inputJson] of toolInputs.entries()) {
            if (toolNames.get(index) !== 'propose_daily_schedule') continue
            try {
              const parsed = JSON.parse(inputJson)
              const proposalParse = DailyScheduleProposalSchema.safeParse(parsed)
              if (!proposalParse.success) {
                console.warn('[Plan Chat] Invalid schedule proposal schema:', proposalParse.error.format())
                continue
              }
              const planValidation = validateProposalAgainstCurrentPlan(proposalParse.data, { date, timezone, planTasks })
              if (!planValidation.success) {
                console.warn('[Plan Chat] Invalid schedule proposal against current plan:', planValidation.error)
                continue
              }
              proposalMetadata = createProposalMetadata({ date, proposal: planValidation.data, currentScheduleHash, currentScheduleExists })
              controller.enqueue(sseEvent('proposal', { metadata: proposalMetadata }))
              break
            } catch (toolError) {
              console.warn('[Plan Chat] Failed to parse schedule proposal tool input:', toolError)
            }
          }

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
            await prisma.chatMessage.create({ data: { userId, date, role: 'user', content: sanitizedUserMessage } })
            const assistantData = proposalMetadata
              ? { userId, date, role: 'assistant', content: assistantMessage, metadataJson: proposalMetadata }
              : { userId, date, role: 'assistant', content: assistantMessage }
            const assistant = await prisma.chatMessage.create({
              data: assistantData,
              select: { id: true },
            })
            controller.enqueue(sseEvent('done', { assistantMessageId: assistant.id }))
          } catch (saveError) {
            console.error('[Plan Chat] Failed to save messages to DB:', saveError)
            // Не блокируем ответ если сохранение не удалось
            controller.enqueue(sseEvent('done', { assistantMessageId: null }))
          }

          controller.close()
        } catch (streamError) {
          console.error('Error in plan chat stream:', streamError)
          controller.enqueue(sseEvent('error', { error: 'Failed to stream chat response' }))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
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
