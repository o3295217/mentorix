'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PeriodType, getPeriodDates } from '@/lib/dates'
import { DreamGoal, Goal, GoalTag } from '@/lib/types'

// Re-export types for backward compatibility
export type { DreamGoal, Goal, GoalTag } from '@/lib/types'

interface UseGoalsReturn {
  // Dream
  dreamGoal: DreamGoal | null
  saveDream: (text: string, years: number) => Promise<void>
  
  // Year goals
  yearGoals: Map<number, string[]>
  loadYearGoals: (year: number) => Promise<void>
  saveYearGoals: (year: number, goals: string[]) => Promise<void>
  addYearGoal: (year: number, text: string) => void
  removeYearGoal: (year: number, index: number) => void
  editYearGoal: (year: number, index: number, text: string) => void
  
  // Period goals
  periodGoals: Map<string, string[]>
  loadPeriodGoalsWithKey: (periodType: PeriodType, date: Date) => Promise<void>
  loadAllWeeksForMonth: (year: number, month: number) => Promise<void>
  savePeriodGoals: (periodType: PeriodType, date: Date, goals: string[], label: string) => Promise<void>
  addPeriodGoal: (periodKey: string, periodType: PeriodType, date: Date, label: string, text: string) => void
  removePeriodGoal: (periodKey: string, index: number, periodType: PeriodType, date: Date, label: string) => void
  editPeriodGoal: (periodKey: string, index: number, periodType: PeriodType, date: Date, label: string, text: string) => void
  
  // Tracked goals (with completion, priority, etc.)
  goals: Goal[]
  loadTrackedGoals: () => Promise<void>
  toggleGoalCompleted: (goalId: number, completed: boolean) => Promise<void>
  updateGoalPriority: (goalId: number, priority: number) => Promise<void>
  setGoalPriority: (periodKey: string, text: string, priority: number) => Promise<void>
  setGoalCompleted: (periodKey: string, text: string, completed: boolean) => Promise<void>
  processingGoals: Set<string>
  
  // Tags
  tags: GoalTag[]
  createTag: (name: string, color: string) => Promise<void>
  deleteTag: (id: number) => Promise<void>
  
  // Progress
  calculatePeriodProgress: (periodKey: string) => { total: number; completed: number; percent: number }
  
  // Utility
  showMessage: (text: string) => void
  message: string
  currentYear: number
}

export function useGoals(): UseGoalsReturn {
  const [dreamGoal, setDreamGoal] = useState<DreamGoal | null>(null)
  const [yearGoals, setYearGoals] = useState<Map<number, string[]>>(new Map())
  const [periodGoals, setPeriodGoals] = useState<Map<string, string[]>>(new Map())
  const [goals, setGoals] = useState<Goal[]>([])
  const [tags, setTags] = useState<GoalTag[]>([])
  const [processingGoals, setProcessingGoals] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')

  // Use ref for processing lock to avoid stale closure issues
  const processingLockRef = useRef<Set<string>>(new Set())

  const currentYear = new Date().getFullYear()

  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const showMessage = useCallback((text: string) => {
    // Clear previous timeout to prevent memory leaks
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current)
      messageTimeoutRef.current = null
    }
    setMessage(text)
    messageTimeoutRef.current = setTimeout(() => {
      setMessage('')
      messageTimeoutRef.current = null
    }, 3000)
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current)
      }
    }
  }, [])

  // Dream operations
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

  const saveDream = useCallback(async (text: string, years: number) => {
    try {
      const res = await fetch('/api/goals/dream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalText: text, years }),
      })
      const data = await res.json()
      setDreamGoal(data)
      showMessage('✅ Мечта сохранена!')
    } catch (error) {
      console.error('Error saving dream:', error)
      showMessage('❌ Ошибка сохранения')
    }
  }, [showMessage])

  // Year goals operations
  const loadYearGoals = useCallback(async (year: number) => {
    try {
      const res = await fetch(`/api/goals/year?year=${year}`)
      const data = await res.json()
      setYearGoals(prev => new Map(prev).set(year, data.goals || []))
    } catch (error) {
      console.error(`Error loading goals for ${year}:`, error)
      showMessage(`❌ Ошибка загрузки целей на ${year} год`)
    }
  }, [showMessage])

  const saveYearGoals = useCallback(async (year: number, goals: string[]) => {
    try {
      await fetch('/api/goals/year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, goals }),
      })
      showMessage(`✅ Цели на ${year} год сохранены!`)
    } catch (error) {
      console.error(`Error saving goals for ${year}:`, error)
      showMessage('❌ Ошибка при сохранении')
    }
  }, [showMessage])

  const addYearGoal = useCallback((year: number, text: string) => {
    if (!text.trim()) return
    setYearGoals(prev => {
      const currentGoals = prev.get(year) || []
      const updatedGoals = [...currentGoals, text.trim()]
      saveYearGoals(year, updatedGoals)
      return new Map(prev).set(year, updatedGoals)
    })
  }, [saveYearGoals])

  const removeYearGoal = useCallback((year: number, index: number) => {
    setYearGoals(prev => {
      const currentGoals = prev.get(year) || []
      const updatedGoals = currentGoals.filter((_, i) => i !== index)
      saveYearGoals(year, updatedGoals)
      return new Map(prev).set(year, updatedGoals)
    })
  }, [saveYearGoals])

  const editYearGoal = useCallback((year: number, index: number, text: string) => {
    if (!text.trim()) {
      removeYearGoal(year, index)
      return
    }
    setYearGoals(prev => {
      const currentGoals = prev.get(year) || []
      const updatedGoals = [...currentGoals]
      updatedGoals[index] = text.trim()
      saveYearGoals(year, updatedGoals)
      return new Map(prev).set(year, updatedGoals)
    })
  }, [removeYearGoal, saveYearGoals])

  // Period goals operations
  const loadPeriodGoalsWithKey = useCallback(async (periodType: PeriodType, date: Date) => {
    try {
      const { start } = getPeriodDates(date, periodType)
      const res = await fetch(`/api/goals/period?type=${periodType}&date=${start.toISOString()}`)
      const data = await res.json()

      let key = ''
      if (periodType === 'quarter') {
        const quarter = Math.floor(date.getMonth() / 3) + 1
        key = `${date.getFullYear()}-Q${quarter}`
      } else if (periodType === 'half_year') {
        const half = date.getMonth() < 6 ? 1 : 2
        key = `${date.getFullYear()}-H${half}`
      } else if (periodType === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      } else if (periodType === 'week') {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
        const current = new Date(firstDay)
        while (current.getDay() !== 1 && current <= date) {
          current.setDate(current.getDate() + 1)
        }
        let weekNum = 1
        while (current <= date) {
          current.setDate(current.getDate() + 7)
          if (current <= date) weekNum++
        }
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-W${weekNum}`
      }

      if (key && data?.goals) {
        setPeriodGoals(prev => new Map(prev).set(key, data.goals))
      }
    } catch (error) {
      console.error(`Error loading period goals:`, error)
      showMessage('❌ Ошибка загрузки целей периода')
    }
  }, [showMessage])

  const loadAllWeeksForMonth = useCallback(async (year: number, month: number) => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    const current = new Date(firstDay)
    while (current.getDay() !== 1) {
      current.setDate(current.getDate() + 1)
    }
    
    const weekPromises: Promise<void>[] = []
    while (current <= lastDay) {
      const weekStart = new Date(current)
      weekPromises.push(loadPeriodGoalsWithKey('week', weekStart))
      current.setDate(current.getDate() + 7)
    }
    await Promise.all(weekPromises)
  }, [loadPeriodGoalsWithKey])

  const savePeriodGoals = useCallback(async (periodType: PeriodType, date: Date, goals: string[], label: string) => {
    try {
      const { start, end } = getPeriodDates(date, periodType)
      await fetch('/api/goals/period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodType,
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          goals,
        }),
      })
      showMessage(`✅ ${label} сохранён`)
    } catch (error) {
      console.error(`Error saving period goals:`, error)
      showMessage('❌ Ошибка при сохранении')
    }
  }, [showMessage])

  const addPeriodGoal = useCallback((periodKey: string, periodType: PeriodType, date: Date, label: string, text: string) => {
    if (!text.trim()) return
    setPeriodGoals(prev => {
      const currentGoals = prev.get(periodKey) || []
      const updatedGoals = [...currentGoals, text.trim()]
      savePeriodGoals(periodType, date, updatedGoals, label)
      return new Map(prev).set(periodKey, updatedGoals)
    })
  }, [savePeriodGoals])

  const removePeriodGoal = useCallback((periodKey: string, index: number, periodType: PeriodType, date: Date, label: string) => {
    setPeriodGoals(prev => {
      const currentGoals = prev.get(periodKey) || []
      const updatedGoals = currentGoals.filter((_, i) => i !== index)
      savePeriodGoals(periodType, date, updatedGoals, label)
      return new Map(prev).set(periodKey, updatedGoals)
    })
  }, [savePeriodGoals])

  const editPeriodGoal = useCallback((periodKey: string, index: number, periodType: PeriodType, date: Date, label: string, text: string) => {
    if (!text.trim()) {
      removePeriodGoal(periodKey, index, periodType, date, label)
      return
    }
    setPeriodGoals(prev => {
      const currentGoals = prev.get(periodKey) || []
      const updatedGoals = [...currentGoals]
      updatedGoals[index] = text.trim()
      savePeriodGoals(periodType, date, updatedGoals, label)
      return new Map(prev).set(periodKey, updatedGoals)
    })
  }, [removePeriodGoal, savePeriodGoals])

  // Tracked goals operations
  const loadTrackedGoals = useCallback(async () => {
    try {
      const res = await fetch('/api/goals/items')
      const data = await res.json()
      if (Array.isArray(data)) setGoals(data)
    } catch (error) {
      console.error('Error loading tracked goals:', error)
    }
  }, [])

  const toggleGoalCompleted = useCallback(async (goalId: number, completed: boolean) => {
    try {
      const res = await fetch('/api/goals/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: goalId, completed }),
      })
      const updated = await res.json()
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, completed: updated.completed, completedAt: updated.completedAt } : g))
      showMessage(completed ? '✅ Выполнено!' : '↩️ Возвращено в работу')
    } catch (error) {
      console.error('Error toggling goal:', error)
      showMessage('❌ Ошибка обновления статуса')
    }
  }, [showMessage])

  const updateGoalPriority = useCallback(async (goalId: number, priority: number) => {
    try {
      const res = await fetch('/api/goals/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: goalId, priority }),
      })
      const updated = await res.json()
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, priority: updated.priority } : g))
      const priorityIcons: Record<number, string> = { 0: '⚪', 1: '🟡', 2: '🔴' }
      showMessage(`✅ Приоритет: ${priorityIcons[priority] || '⚪'}`)
    } catch (error) {
      console.error('Error updating priority:', error)
      showMessage('❌ Ошибка обновления приоритета')
    }
  }, [showMessage])

  const createTrackedGoal = useCallback(async (periodKey: string, text: string, priority: number = 0): Promise<Goal | null> => {
    const lockKey = `${periodKey}-${text}`

    // Use ref-based lock to prevent race conditions across renders
    if (processingLockRef.current.has(lockKey)) {
      return null
    }

    // Check if goal already exists in current state
    const existingGoal = goals.find(g => g.periodKey === periodKey && g.text === text)
    if (existingGoal) return existingGoal

    // Acquire lock
    processingLockRef.current.add(lockKey)
    setProcessingGoals(prev => new Set(prev).add(lockKey))

    try {
      let periodType = 'week'
      if (periodKey.includes('-Q')) periodType = 'quarter'
      else if (periodKey.match(/^\d{4}-\d{2}$/)) periodType = 'month'
      else if (periodKey.includes('-W')) periodType = 'week'

      const res = await fetch('/api/goals/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, periodType, periodKey, priority }),
      })
      const newGoal = await res.json()
      if (newGoal.id) {
        setGoals(prev => {
          // Double-check to prevent duplicates
          if (prev.some(g => g.periodKey === periodKey && g.text === text)) {
            return prev
          }
          return [...prev, newGoal]
        })
        const priorityIcons: Record<number, string> = { 0: '⚪', 1: '🟡', 2: '🔴' }
        if (priority > 0) showMessage(`✅ Приоритет установлен: ${priorityIcons[priority]}`)
        return newGoal
      }
    } catch (error) {
      console.error('Error creating tracked goal:', error)
      showMessage('❌ Ошибка создания цели')
    } finally {
      // Release lock
      processingLockRef.current.delete(lockKey)
      setProcessingGoals(prev => {
        const next = new Set(prev)
        next.delete(lockKey)
        return next
      })
    }
    return null
  }, [goals, showMessage])

  const setGoalPriority = useCallback(async (periodKey: string, text: string, priority: number) => {
    const trackedGoal = goals.find(g => g.periodKey === periodKey && g.text === text)
    
    if (trackedGoal) {
      await updateGoalPriority(trackedGoal.id, priority)
    } else {
      await createTrackedGoal(periodKey, text, priority)
    }
    await loadTrackedGoals()
  }, [goals, updateGoalPriority, createTrackedGoal, loadTrackedGoals])

  const setGoalCompleted = useCallback(async (periodKey: string, text: string, completed: boolean) => {
    const trackedGoal = goals.find(g => g.periodKey === periodKey && g.text === text)
    
    if (trackedGoal) {
      await toggleGoalCompleted(trackedGoal.id, completed)
    } else {
      const newGoal = await createTrackedGoal(periodKey, text, 0)
      if (newGoal && completed) {
        await toggleGoalCompleted(newGoal.id, true)
      }
    }
    await loadTrackedGoals()
  }, [goals, toggleGoalCompleted, createTrackedGoal, loadTrackedGoals])

  // Tags operations
  const loadTags = useCallback(async () => {
    try {
      const res = await fetch('/api/goals/tags')
      const data = await res.json()
      setTags(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading tags:', error)
      setTags([])
    }
  }, [])

  const createTag = useCallback(async (name: string, color: string) => {
    if (!name.trim()) return
    try {
      const res = await fetch('/api/goals/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color }),
      })
      const tag = await res.json()
      setTags(prev => [...prev, tag])
      showMessage('✅ Тег создан')
    } catch (error) {
      console.error('Error creating tag:', error)
      showMessage('❌ Ошибка создания тега')
    }
  }, [showMessage])

  const deleteTag = useCallback(async (id: number) => {
    try {
      await fetch(`/api/goals/tags?id=${id}`, { method: 'DELETE' })
      setTags(prev => prev.filter(t => t.id !== id))
      showMessage('🗑️ Тег удалён')
    } catch (error) {
      console.error('Error deleting tag:', error)
      showMessage('❌ Ошибка удаления тега')
    }
  }, [showMessage])

  // Progress calculation
  const calculatePeriodProgress = useCallback((periodKey: string): { total: number; completed: number; percent: number } => {
    const periodGoalsList = periodGoals.get(periodKey) || []
    const total = periodGoalsList.length
    const completed = periodGoalsList.filter(goalText => {
      const trackedGoal = goals.find(g => g.periodKey === periodKey && g.text === goalText)
      return trackedGoal?.completed
    }).length
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, percent }
  }, [periodGoals, goals])

  // Initial load
  useEffect(() => {
    loadDream()
    loadTags()
    loadTrackedGoals()
  }, [loadDream, loadTags, loadTrackedGoals])

  return {
    dreamGoal,
    saveDream,
    yearGoals,
    loadYearGoals,
    saveYearGoals,
    addYearGoal,
    removeYearGoal,
    editYearGoal,
    periodGoals,
    loadPeriodGoalsWithKey,
    loadAllWeeksForMonth,
    savePeriodGoals,
    addPeriodGoal,
    removePeriodGoal,
    editPeriodGoal,
    goals,
    loadTrackedGoals,
    toggleGoalCompleted,
    updateGoalPriority,
    setGoalPriority,
    setGoalCompleted,
    processingGoals,
    tags,
    createTag,
    deleteTag,
    calculatePeriodProgress,
    showMessage,
    message,
    currentYear,
  }
}
