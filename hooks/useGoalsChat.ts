'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { DreamGoal, Goal } from '@/lib/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ParsedGoal {
  text: string
  periodType: 'year' | 'half_year' | 'quarter' | 'month' | 'week'
  periodKey: string // e.g. "2026", "2026-H1", "2026-Q1", "2026-03", "2026-03-W1"
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

const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

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

      const res = await fetch('/api/goals/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context,
          history: currentHistory,
        }),
      })

      if (!res.ok) throw new Error(`API error: ${res.status}`)

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
    } catch (error) {
      console.error('Goals chat error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Произошла ошибка при обращении к ИИ. Попробуй снова.',
      }])
    } finally {
      isLoadingRef.current = false
      setIsLoading(false)
    }
  }, [dreamGoal, yearGoals, periodGoals, selectedYear, selectedMonth])

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
    const lines = text.split('\n')
    const goals: ParsedGoal[] = []
    
    // Default to current month if no marker found
    const defaultKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
    let currentPeriodType: 'year' | 'half_year' | 'quarter' | 'month' | 'week' = 'month'
    let currentPeriodKey = defaultKey
    
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
        continue
      }
      if (halfYearMatch) {
        currentPeriodType = 'half_year'
        currentPeriodKey = halfYearMatch[1]
        continue
      }
      if (quarterMatch) {
        currentPeriodType = 'quarter'
        currentPeriodKey = quarterMatch[1]
        continue
      }
      if (monthMatch) {
        currentPeriodType = 'month'
        currentPeriodKey = monthMatch[1]
        continue
      }
      if (weekMatch) {
        currentPeriodType = 'week'
        currentPeriodKey = weekMatch[1]
        continue
      }
      
      // Match numbered or bullet-point lines: "1. ...", "- ...", "• ...", "1) ..."
      const match = trimmed.match(/^(?:\d+[.)]\s*|[-–—•]\s+)(.+)/)
      if (match && match[1].length > 3 && match[1].length < 200) {
        goals.push({
          text: match[1].trim(),
          periodType: currentPeriodType,
          periodKey: currentPeriodKey,
        })
      }
    }
    return goals
  }, [selectedYear, selectedMonth])

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
