import { useEffect, useRef } from 'react'
import type { ParsedProfile } from '@/hooks/useGoalsChat'

interface DreamGoal {
  goalText: string
  horizonYears?: number
  createdAt: string
}

interface UseAutoSaveProfileDeps {
  chatMessages: { role: string; content: string }[]
  chatLoading: boolean
  extractProfile: (text: string) => ParsedProfile | null
  extractHorizon: (text: string) => number | null
  extractProfileDeclined: (text: string) => boolean
  showMessage: (msg: string) => void
  dreamGoal: DreamGoal | null
  saveDream: (text: string, horizon: number | null) => void
}

export function useAutoSaveProfile({
  chatMessages,
  chatLoading,
  extractProfile,
  extractHorizon,
  extractProfileDeclined,
  showMessage,
  dreamGoal,
  saveDream,
}: UseAutoSaveProfileDeps) {
  const lastSavedProfileRef = useRef('')
  const lastSavedHorizonRef = useRef(0)
  const profileDeclineSavedRef = useRef(false)

  useEffect(() => {
    if (chatLoading || chatMessages.length === 0) return
    const lastMsg = chatMessages[chatMessages.length - 1]
    if (lastMsg.role !== 'assistant') return

    // Сохранение профиля
    const profile = extractProfile(lastMsg.content)
    if (profile) {
      const profileKey = JSON.stringify(profile)
      if (profileKey !== lastSavedProfileRef.current) {
        lastSavedProfileRef.current = profileKey
        fetch('/api/goals/planning-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...profile, declined: false }),
        }).then(() => {
          showMessage('Профиль планирования сохранён')
        }).catch(() => {
          lastSavedProfileRef.current = ''
        })
      }
    }

    // Сохранение отказа от профиля
    if (!profileDeclineSavedRef.current && extractProfileDeclined(lastMsg.content)) {
      profileDeclineSavedRef.current = true
      fetch('/api/goals/planning-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ declined: true }),
      }).catch(() => {
        profileDeclineSavedRef.current = false
      })
    }

    // Сохранение горизонта
    const horizon = extractHorizon(lastMsg.content)
    if (horizon && horizon !== lastSavedHorizonRef.current && dreamGoal) {
      lastSavedHorizonRef.current = horizon
      saveDream(dreamGoal.goalText, horizon)
    }
  }, [chatMessages, chatLoading, extractProfile, extractHorizon, extractProfileDeclined, showMessage, dreamGoal, saveDream])
}
