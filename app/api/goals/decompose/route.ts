import { NextRequest, NextResponse } from 'next/server'
import { getAnthropicClient } from '@/lib/anthropic'
import { requireUserId } from '@/lib/get-user-id'
import { buildGoalsDecomposePrompt } from '@/lib/prompts/goals-decompose'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import { z } from 'zod'

const GoalsDecomposeSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  context: z.object({
    dream: z.string().trim().max(500),
    dreamMonths: z.number().int().min(1).max(600).optional(),
    yearGoals: z.record(z.string(), z.array(z.string().trim().max(500)).max(50)),
    periodGoals: z.record(z.string(), z.array(z.string().trim().max(500)).max(50)),
    completedGoals: z.record(z.string(), z.array(z.string().trim().max(500)).max(50)).optional(),
    selectedYear: z.number().int().min(2000).max(2100),
    selectedMonth: z.number().int().min(0).max(11),
  }),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(4000),
  })).max(20).optional(),
})

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

    if (!message) {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
    }

    // Загружаем профиль планирования
    const planningProfile = await prisma.planningProfile.findUnique({ where: { userId } })

    const systemPrompt = buildGoalsDecomposePrompt(context, planningProfile)
    const anthropic = getAnthropicClient()

    const chatHistory = Array.isArray(history)
      ? history
          .filter((h: unknown) => {
            if (typeof h !== 'object' || h === null) return false
            const msg = h as Record<string, unknown>
            return (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string'
          })
          .slice(-20) // limit history to last 20 messages
          .map((h: { role: string; content: string }) => ({
            role: h.role as 'user' | 'assistant',
            content: h.content.slice(0, 4000), // limit per-message length
          }))
      : []

    const messages = [
      ...chatHistory,
      { role: 'user' as const, content: message },
    ]

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
        } catch (err) {
          console.error('Stream error:', err)
        } finally {
          controller.close()
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
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (typeof statusCode === 'number') {
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
