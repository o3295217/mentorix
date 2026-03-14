'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { DreamGoal } from '@/lib/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface UseGoalsChatReturn {
  messages: ChatMessage[]
  sendMessage: (text: string) => Promise<void>
  isLoading: boolean
  contextLabel: string
  clearMessages: () => void
  extractGoals: (text: string) => string[]
  startGuidedFlow: () => void
}

const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

export function useGoalsChat(
  dreamGoal: DreamGoal | null,
  yearGoals: Map<number, string[]>,
  periodGoals: Map<string, string[]>,
  selectedYear: number,
  selectedMonth: number,
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
      const context = {
        dream: dreamGoal?.goalText || '',
        dreamYears: dreamGoal?.years || 5,
        yearGoals: Object.fromEntries(yearGoals),
        periodGoals: Object.fromEntries(periodGoals),
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
    sendMessage('Помоги разложить мою мечту: предложи годовые цели, а потом разберём ближайший месяц на недели.')
  }, [sendMessage])

  // Extract goal-like lines from AI response
  const extractGoals = useCallback((text: string): string[] => {
    const lines = text.split('\n')
    const goals: string[] = []
    for (const line of lines) {
      const trimmed = line.trim()
      // Match numbered or bullet-point lines: "1. ...", "- ...", "• ...", "1) ..."
      const match = trimmed.match(/^(?:\d+[.)]\s*|[-–—•]\s+)(.+)/)
      if (match && match[1].length > 3 && match[1].length < 200) {
        goals.push(match[1].trim())
      }
    }
    return goals
  }, [])

  return {
    messages,
    sendMessage,
    isLoading,
    contextLabel,
    clearMessages,
    extractGoals,
    startGuidedFlow,
  }
}
