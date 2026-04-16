'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { DreamGoal, Goal } from '@/lib/types'
import { MONTH_NAMES } from '@/lib/goals-utils'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ParsedGoal {
  text: string
  periodType: 'year' | 'half_year' | 'quarter' | 'month' | 'week'
  periodKey: string // e.g. "2026", "2026-H1", "2026-Q1", "2026-03", "2026-03-W1"
  hierarchyNumber?: string // e.g. "1", "1.1", "1.1.1" — shows parent-child chain
}

export interface ParsedProfile {
  hoursPerWeek?: number
  experienceLevel?: string
  hasBudget?: string
  currentWorkload?: string
  constraints?: string
}

interface UseGoalsChatReturn {
  messages: ChatMessage[]
  sendMessage: (text: string) => Promise<void>
  isLoading: boolean
  contextLabel: string
  clearMessages: () => void
  extractGoals: (text: string) => ParsedGoal[]
  extractProfile: (text: string) => ParsedProfile | null
  extractHorizon: (text: string) => number | null
  extractProfileDeclined: (text: string) => boolean
  startGuidedFlow: () => void
}

export function useGoalsChat(
  dreamGoal: DreamGoal | null,
  yearGoals: Map<number, string[]>,
  periodGoals: Map<string, string[]>,
  selectedYear: number,
  selectedMonth: number,
  goals: Goal[] = [],
): UseGoalsChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const isLoadingRef = useRef(false)
  const messagesRef = useRef<ChatMessage[]>([])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const contextLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoadingRef.current) return

    isLoadingRef.current = true
    setIsLoading(true)

    const currentHistory = messagesRef.current
    const userMessage: ChatMessage = { role: 'user', content: text }
    setMessages(prev => [...prev, userMessage])

    try {
      // Build completed goals map from tracked goals
      const completedGoals: Record<string, string[]> = {}
      for (const g of goals) {
        if (g.completed) {
          if (!completedGoals[g.periodKey]) completedGoals[g.periodKey] = []
          completedGoals[g.periodKey].push(g.text)
        }
      }

      const context = {
        dream: dreamGoal?.goalText || '',
        dreamMonths: dreamGoal?.months || undefined,
        yearGoals: Object.fromEntries(yearGoals),
        periodGoals: Object.fromEntries(periodGoals),
        completedGoals,
        selectedYear,
        selectedMonth,
      }

      // Retry logic for transient proxy/API errors
      let res: Response | null = null
      const maxRetries = 2
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          res = await fetch('/api/goals/decompose', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: text,
              context,
              history: currentHistory,
            }),
          })
          if (res.ok) break
          let apiError = `API error: ${res.status}`
          try {
            const errorPayload = await res.json()
            if (typeof errorPayload?.error === 'string') {
              apiError = errorPayload.error
            }
          } catch {
            // Ignore non-JSON error bodies
          }
          // Don't retry client errors (4xx)
          if (res.status >= 400 && res.status < 500) throw new Error(apiError)
          // Retry server errors (5xx)
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
            continue
          }
          throw new Error(apiError)
        } catch (fetchError) {
          if (attempt < maxRetries && !(fetchError instanceof Error && fetchError.message.startsWith('API error: 4'))) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
            continue
          }
          throw fetchError
        }
      }
      if (!res || !res.ok) throw new Error('API request failed after retries')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          assistantContent += chunk
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
            return updated
          })
        }
      }

      if (!assistantContent.trim()) {
        throw new Error('Пустой ответ от ИИ')
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error('Goals chat error:', errMsg, error)
      setMessages(prev => {
        const fallbackMessage: ChatMessage = {
          role: 'assistant',
          content: `❌ Произошла ошибка при обращении к ИИ. Попробуй снова.\n(${errMsg})`,
        }

        if (prev.length > 0) {
          const updated = [...prev]
          const lastMessage = updated[updated.length - 1]
          if (lastMessage.role === 'assistant' && !lastMessage.content.trim()) {
            updated[updated.length - 1] = fallbackMessage
            return updated
          }
        }

        return [...prev, fallbackMessage]
      })
    } finally {
      isLoadingRef.current = false
      setIsLoading(false)
    }
  }, [dreamGoal, yearGoals, periodGoals, selectedYear, selectedMonth, goals])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  // Start guided cascade flow — auto-send initial prompt to AI
  const startGuidedFlow = useCallback(() => {
    if (messagesRef.current.length > 0 || isLoadingRef.current) return
    sendMessage('Привет! Помоги мне спланировать путь к моей мечте.')
  }, [sendMessage])

  // Extract goal-like lines from AI response with period markers
  const extractGoals = useCallback((text: string): ParsedGoal[] => {
    // Only extract goals when explicit period markers are present.
    // Without markers, numbered lines are just discussion text, not actionable goals.
    const hasPeriodMarker = /\[(YEAR|HALF_YEAR|QUARTER|MONTH|WEEK):[^\]]+\]/.test(text)
    if (!hasPeriodMarker) return []

    const lines = text.split('\n')
    const goals: ParsedGoal[] = []
    
    let markerFound = false
    let currentPeriodType: 'year' | 'half_year' | 'quarter' | 'month' | 'week' = 'month'
    let currentPeriodKey = ''
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      // Check for period markers: [YEAR:2026], [HALF_YEAR:2026-H1], [QUARTER:2026-Q1], [MONTH:2026-03], [WEEK:2026-03-W1]
      const yearMatch = trimmed.match(/\[YEAR:(\d{4})\]/)
      const halfYearMatch = trimmed.match(/\[HALF_YEAR:(\d{4}-H[12])\]/)
      const quarterMatch = trimmed.match(/\[QUARTER:(\d{4}-Q[1-4])\]/)
      const monthMatch = trimmed.match(/\[MONTH:(\d{4}-\d{2})\]/)
      const weekMatch = trimmed.match(/\[WEEK:(\d{4}-\d{2}-W\d+)\]/)
      
      if (yearMatch) {
        currentPeriodType = 'year'
        currentPeriodKey = yearMatch[1]
        markerFound = true
        continue
      }
      if (halfYearMatch) {
        currentPeriodType = 'half_year'
        currentPeriodKey = halfYearMatch[1]
        markerFound = true
        continue
      }
      if (quarterMatch) {
        currentPeriodType = 'quarter'
        currentPeriodKey = quarterMatch[1]
        markerFound = true
        continue
      }
      if (monthMatch) {
        currentPeriodType = 'month'
        currentPeriodKey = monthMatch[1]
        markerFound = true
        continue
      }
      if (weekMatch) {
        currentPeriodType = 'week'
        currentPeriodKey = weekMatch[1]
        markerFound = true
        continue
      }
      
      // Only collect goals AFTER a period marker has been encountered
      if (!markerFound) continue
      
      // Match hierarchical numbered lines: "1.1.1. ...", "1. ...", or bullet-point lines: "- ...", "• ...", "1) ..."
      const hierarchyMatch = trimmed.match(/^(\d+(?:\.\d+)*)[.)]\s+(.+)/)
      if (hierarchyMatch && hierarchyMatch[2].length > 3 && hierarchyMatch[2].length < 200) {
        goals.push({
          text: hierarchyMatch[2].trim(),
          periodType: currentPeriodType,
          periodKey: currentPeriodKey,
          hierarchyNumber: hierarchyMatch[1],
        })
        continue
      }
      // Match bullet-point lines: "- ...", "• ...", "– ..."
      const bulletMatch = trimmed.match(/^[-–—•]\s+(.+)/)
      if (bulletMatch && bulletMatch[1].length > 3 && bulletMatch[1].length < 200) {
        goals.push({
          text: bulletMatch[1].trim(),
          periodType: currentPeriodType,
          periodKey: currentPeriodKey,
        })
      }
    }
    return goals
  }, [])

  // Extract [HORIZON:N] marker from AI response
  const extractHorizon = useCallback((text: string): number | null => {
    const match = text.match(/\[HORIZON:(\d+)\]/)
    if (!match) return null
    const months = parseInt(match[1], 10)
    return months > 0 && months <= 360 ? months : null
  }, [])

  // Extract [PROFILE_DECLINED] marker from AI response
  const extractProfileDeclined = useCallback((text: string): boolean => {
    return text.includes('[PROFILE_DECLINED]')
  }, [])

  // Extract [PROFILE:...] marker from AI response
  const extractProfile = useCallback((text: string): ParsedProfile | null => {
    const match = text.match(/\[PROFILE:([^\]]+)\]/)
    if (!match) return null

    const pairs = match[1].split('|')
    const data: Record<string, string> = {}
    for (const pair of pairs) {
      const [key, ...rest] = pair.split('=')
      if (key && rest.length > 0) data[key.trim()] = rest.join('=').trim()
    }

    const profile: ParsedProfile = {}
    if (data.hours) profile.hoursPerWeek = parseInt(data.hours, 10) || undefined
    if (data.experience) profile.experienceLevel = data.experience
    if (data.workload) profile.currentWorkload = data.workload
    if (data.budget) profile.hasBudget = data.budget
    if (data.constraints) profile.constraints = data.constraints

    return Object.keys(profile).length > 0 ? profile : null
  }, [])

  return {
    messages,
    sendMessage,
    isLoading,
    contextLabel,
    clearMessages,
    extractGoals,
    extractProfile,
    extractHorizon,
    extractProfileDeclined,
    startGuidedFlow,
  }
}
