import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_ROUTE_AI_MODEL, getAiModel, getAnthropicClient } from '@/lib/anthropic'
import { requireUserId } from '@/lib/get-user-id'
import { buildGoalsDecomposePrompt } from '@/lib/prompts/goals-decompose'
import { buildGoalsValidatePrompt } from '@/lib/prompts/goals-validate'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import { z } from 'zod'

const PLAN_MARKER_RE = /\[(YEAR|HALF_YEAR|QUARTER|MONTH|WEEK):/

const MAX_MESSAGE_LENGTH = 2000
const MAX_DREAM_LENGTH = 2000
const MAX_GOAL_LENGTH = 1000
const MAX_HISTORY_LENGTH = 4000
const MAX_GOALS_PER_PERIOD = 50
const MAX_OUTPUT_TOKENS = 16000

const GoalsDecomposeSchema = z.object({
  message: z.string().trim().min(1).max(8000),
  context: z.object({
    dream: z.string().trim().max(8000),
    dreamMonths: z.number().int().min(1).max(600).optional(),
    yearGoals: z.record(z.string(), z.array(z.string()).max(MAX_GOALS_PER_PERIOD)),
    periodGoals: z.record(z.string(), z.array(z.string()).max(MAX_GOALS_PER_PERIOD)),
    completedGoals: z.record(z.string(), z.array(z.string()).max(MAX_GOALS_PER_PERIOD)).optional(),
    selectedYear: z.number().int().min(2000).max(2100),
    selectedMonth: z.number().int().min(0).max(11),
  }),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(60000),
  })).max(20).optional(),
})

function clampText(value: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trim()}…`
}

function sanitizeGoalMap(goalMap: Record<string, string[]> | undefined): Record<string, string[]> {
  if (!goalMap) return {}

  return Object.fromEntries(
    Object.entries(goalMap).map(([periodKey, goals]) => [
      periodKey,
      goals
        .filter((goal): goal is string => typeof goal === 'string')
        .map((goal) => clampText(goal, MAX_GOAL_LENGTH))
        .filter(Boolean)
        .slice(0, MAX_GOALS_PER_PERIOD),
    ])
  )
}

function sanitizeHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }> | undefined
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!Array.isArray(history)) return []

  return history
    .filter((message) => (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string')
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: clampText(message.content, MAX_HISTORY_LENGTH),
    }))
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const rateLimit = checkRateLimit(userId, rateLimiters.ai)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before sending another message.', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const validation = GoalsDecomposeSchema.safeParse(await request.json())
    if (!validation.success) {
      console.error('Goals decompose validation failed:', JSON.stringify(validation.error.format(), null, 2))
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { message, context, history } = validation.data
    const sanitizedMessage = clampText(message, MAX_MESSAGE_LENGTH)
    const sanitizedContext = {
      ...context,
      dream: clampText(context.dream, MAX_DREAM_LENGTH),
      yearGoals: sanitizeGoalMap(context.yearGoals),
      periodGoals: sanitizeGoalMap(context.periodGoals),
      completedGoals: sanitizeGoalMap(context.completedGoals),
    }
    const sanitizedHistory = sanitizeHistory(history)

    if (!sanitizedMessage) {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
    }

    // Загружаем профиль планирования и профиль пользователя
    let planningProfile: Awaited<ReturnType<typeof prisma.planningProfile.findUnique>> = null
    let userProfile: Awaited<ReturnType<typeof prisma.userProfile.findFirst>> = null
    let profileBlocks: { title: string; categories: { title: string; items: { fieldName: string; fieldValue: string; content: string | null }[] }[]; items: { fieldName: string; fieldValue: string; content: string | null }[] }[] = []
    try {
      const [pp, up, pb] = await Promise.all([
        prisma.planningProfile.findUnique({ where: { userId } }),
        prisma.userProfile.findFirst({ where: { userId } }),
        prisma.profileBlock.findMany({
          where: { userId },
          include: {
            categories: {
              include: { items: { orderBy: { order: 'asc' } } },
              orderBy: { order: 'asc' },
            },
            items: {
              where: { categoryId: null },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        }),
      ])
      planningProfile = pp
      userProfile = up
      profileBlocks = pb
    } catch (dbError) {
      console.error('Failed to load profiles:', dbError)
    }

    const systemPrompt = buildGoalsDecomposePrompt(sanitizedContext, planningProfile, userProfile, profileBlocks)
    const anthropic = getAnthropicClient()
    const model = getAiModel(DEFAULT_ROUTE_AI_MODEL)

    const messages = [
      ...sanitizedHistory,
      { role: 'user' as const, content: sanitizedMessage },
    ]

    const encoder = new TextEncoder()
    const streamHeaders = {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked',
    }

    // Стратегия 1: Настоящий стриминг от Claude (для вопросов и обычных ответов).
    // Буферизируем первые ~200 символов чтобы определить, есть ли метки плана.
    // Если меток нет — переключаемся на прямой стриминг остатка.
    // Если есть — буферизируем всё, валидируем, стримим плавно.

    const stream = anthropic.messages.stream({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemPrompt,
      messages,
    })

    const readable = new ReadableStream({
      async start(controller) {
        try {
          let buffer = ''
          let decided = false
          let isPlan = false

          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const text = event.delta.text

              if (!decided) {
                // Буферизируем начало чтобы определить тип ответа
                buffer += text
                if (buffer.length >= 200 || PLAN_MARKER_RE.test(buffer)) {
                  decided = true
                  isPlan = PLAN_MARKER_RE.test(buffer)

                  if (!isPlan) {
                    // Обычный ответ — отдаём буфер и продолжаем стримить напрямую
                    controller.enqueue(encoder.encode(buffer))
                    buffer = ''
                  }
                  // Если план — продолжаем буферизировать
                }
              } else if (isPlan) {
                buffer += text
              } else {
                // Прямой стриминг обычного ответа
                controller.enqueue(encoder.encode(text))
              }
            }
          }

          // Если так и не решили (короткий ответ < 200 символов) — это обычный ответ
          if (!decided) {
            controller.enqueue(encoder.encode(buffer))
            controller.close()
            return
          }

          if (!isPlan) {
            // Обычный ответ закончился — закрываем
            controller.close()
            return
          }

          // === ПЛАН: буферизирован полностью, прогоняем валидацию ===
          let finalText = buffer

          try {
            const dreamText = sanitizedContext.dream
            const validatePrompt = buildGoalsValidatePrompt(dreamText, finalText)

            const validationResponse = await anthropic.messages.create({
              model,
              max_tokens: MAX_OUTPUT_TOKENS,
              system: validatePrompt,
              messages: [{ role: 'user', content: 'Проверь и верни исправленный план.' }],
            })

            const validatedText = validationResponse.content
              .filter((block) => block.type === 'text')
              .map((block) => 'text' in block ? block.text : '')
              .join('')

            if (PLAN_MARKER_RE.test(validatedText) && validatedText.length > 100) {
              finalText = validatedText
            }
          } catch (validationError) {
            console.error('Plan validation failed, using original:', validationError)
          }

          // Плавная посимвольная отдача плана (титры)
          // ~30 символов каждые 50мс = ~600 символов/сек — комфортная скорость чтения
          const CHUNK = 30
          const DELAY = 50
          for (let i = 0; i < finalText.length; i += CHUNK) {
            controller.enqueue(encoder.encode(finalText.slice(i, i + CHUNK)))
            await new Promise(resolve => setTimeout(resolve, DELAY))
          }

          controller.close()
        } catch (streamError) {
          controller.error(streamError)
        }
      },
    })

    return new Response(readable, { headers: streamHeaders })
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode ?? (error as { status?: number })?.status
    if (typeof statusCode === 'number') {
      console.error('Goals decompose API error:', statusCode, (error as Error)?.message)
      return NextResponse.json(
        { error: (error as Error)?.message || 'Unauthorized' },
        { status: statusCode }
      )
    }
    console.error('Goals decompose error:', {
      message: (error as Error)?.message,
      name: (error as Error)?.name,
      status: (error as { status?: number })?.status,
      statusCode: (error as { statusCode?: number })?.statusCode,
    })
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
