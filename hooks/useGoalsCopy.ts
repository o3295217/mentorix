'use client'

import { useState, useCallback } from 'react'

interface UseGoalsCopyReturn {
  copyDropdown: string | null
  setCopyDropdown: (key: string | null) => void
  isDuplicate: (goals: string[], newGoal: string) => boolean
}

export function useGoalsCopy(): UseGoalsCopyReturn {
  const [copyDropdown, setCopyDropdown] = useState<string | null>(null)

  const isDuplicate = useCallback((goals: string[], newGoal: string): boolean => {
    const normalize = (s: string) => s.toLowerCase().trim()
    return goals.some(g => normalize(g) === normalize(newGoal))
  }, [])

  return {
    copyDropdown,
    setCopyDropdown,
    isDuplicate,
  }
}
