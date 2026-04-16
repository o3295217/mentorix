import { NextRequest, NextResponse } from 'next/server'
import { getAnthropicClient } from '@/lib/anthropic'
import { requireUserId } from '@/lib/get-user-id'
import { buildGoalsDecomposePrompt } from '@/lib/prompts/goals-decompose'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import { z } from 'zod'

const MAX_MESSAGE_LENGTH = 2000
const MAX_DREAM_LENGTH = 2000
const MAX_GOAL_LENGTH = 1000
const MAX_HISTORY_LENGTH = 4000
const MAX_GOALS_PER_PERIOD = 50
const MAX_OUTPUT_TOKENS = 3200

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
    content: z.string().max(12000),
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

    const messages = [
      ...sanitizedHistory,
      { role: 'user' as const, content: sanitizedMessage },
    ]

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemPrompt,
      messages,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        let streamFailed = false
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
        } catch (err) {
          streamFailed = true
          console.error('Stream error:', err)
          controller.error(err instanceof Error ? err : new Error('Goals chat stream failed'))
        } finally {
          if (!streamFailed) {
            controller.close()
          }
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
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
