import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { parseDateParam, toDateKey } from '@/lib/dates'
import { buildFactFromSelection, splitLines } from '@/lib/fact-utils'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import {
  CHECK_PLAN_SYSTEM_PROMPT,
  buildCheckPlanPrompt,
  CheckPlanRequest,
  CheckPlanResponse
} from '@/lib/prompts/check-plan'
import { requireUserId } from '@/lib/get-user-id'
import { logAIUsage } from '@/lib/ai-usage'
import { getAiModel, getAnthropicClient } from '@/lib/anthropic'
import { getPlanUserContext } from '@/lib/user-context'

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
    const userId = await requireUserId(request)

    // Rate limiting by userId (not spoofable IP)
    const rateLimit = checkRateLimit(userId, rateLimiters.ai)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before checking the plan again.', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }
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

    const planContext = await getPlanUserContext(userId, targetDate)

    // Получить историю за последние 7 дней
    const historyStart = new Date(targetDate)
    historyStart.setDate(historyStart.getDate() - 7)
    
    const recentEntries = await prisma.dailyEntry.findMany({
      where: {
        userId,
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

    // Построить запрос
    const checkRequest: CheckPlanRequest = {
      date,
      dayOfWeek: getDayOfWeek(date),
      planTasks,
      weekGoals: planContext.weekGoals,
      monthGoals: planContext.monthGoals,
      dreamGoal: planContext.dreamGoal,
      recentHistory,
      profile: planContext.profile,
      insights: planContext.insights,
    }

    const userPrompt = buildCheckPlanPrompt(checkRequest)

    // Вызов Claude API
    const startTime = Date.now()
    // Проверка плана дня — частая простая задача, используем FAST-модель
    const model = getAiModel('fast')
    const message = await getAnthropicClient().messages.create({
      model,
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
    const durationMs = Date.now() - startTime

    // Логируем использование AI
    await logAIUsage({
      userId,
      endpoint: 'check-plan',
      model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      durationMs,
      success: true,
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
