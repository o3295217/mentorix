'use client'

import { useState, useCallback } from 'react'
import { DreamGoal } from '@/lib/types'

export function useDreamGoal(showMessage: (text: string) => void) {
  const [dreamGoal, setDreamGoal] = useState<DreamGoal | null>(null)

  const loadDream = useCallback(async () => {
    try {
      const res = await fetch('/api/goals/dream')
      const data = await res.json()
      if (data) setDreamGoal(data)
    } catch (error) {
      console.error('Error loading dream:', error)
      showMessage('❌ Ошибка загрузки мечты')
    }
  }, [showMessage])

  const saveDream = useCallback(async (text: string, months: number | null) => {
    try {
      const res = await fetch('/api/goals/dream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalText: text, months }),
      })
      const data = await res.json()
      setDreamGoal(data)
      showMessage('✅ Мечта сохранена!')
    } catch (error) {
      console.error('Error saving dream:', error)
      showMessage('❌ Ошибка сохранения')
    }
  }, [showMessage])

  return { dreamGoal, loadDream, saveDream }
}
