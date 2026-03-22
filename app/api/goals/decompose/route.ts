import { NextRequest, NextResponse } from 'next/server'
import { getAnthropicClient } from '@/lib/anthropic'
import { requireUserId } from '@/lib/get-user-id'
import { buildGoalsDecomposePrompt } from '@/lib/prompts/goals-decompose'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)

    const body = await request.json()
    const { message, context, history } = body

    if (!message || typeof message !== 'string' || message.length > 2000) {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
    }

    // Загружаем профиль планирования
    const planningProfile = await prisma.planningProfile.findUnique({ where: { userId } })

    const systemPrompt = buildGoalsDecomposePrompt(context || {}, planningProfile)
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
    console.error('Goals decompose error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
