'use client'

import { useState, useCallback, useRef } from 'react'
import { Goal, GoalTag } from '@/lib/types'
import { fuzzyMatchGoal, periodTypeFromKey } from '@/lib/goals-utils'

export function useTrackedGoals(
  showMessage: (text: string) => void,
  periodGoals: Map<string, string[]>,
) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [tags, setTags] = useState<GoalTag[]>([])
  const [processingGoals, setProcessingGoals] = useState<Set<string>>(new Set())
  const processingLockRef = useRef<Set<string>>(new Set())

  // Tracked goals operations
  const loadTrackedGoals = useCallback(async (): Promise<Goal[]> => {
    try {
      const res = await fetch('/api/goals/items')
      const data = await res.json()
      if (Array.isArray(data)) {
        setGoals(data)
        return data
      }
    } catch (error) {
      console.error('Error loading tracked goals:', error)
    }
    return []
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

  const createTrackedGoal = useCallback(async (periodKey: string, text: string, priority: number = 0, tags: string[] = [], parentId: number | null = null): Promise<Goal | null> => {
    const lockKey = `${periodKey}-${text}`

    if (processingLockRef.current.has(lockKey)) {
      return null
    }

    const existingGoal = goals.find(g => g.periodKey === periodKey && g.text === text)
    if (existingGoal) return existingGoal

    processingLockRef.current.add(lockKey)
    setProcessingGoals(prev => new Set(prev).add(lockKey))

    try {
      const periodType = periodTypeFromKey(periodKey)

      const res = await fetch('/api/goals/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, periodType, periodKey, priority, tags, parentId }),
      })
      const newGoal = await res.json()
      if (newGoal.id) {
        setGoals(prev => {
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
      processingLockRef.current.delete(lockKey)
      setProcessingGoals(prev => {
        const next = new Set(prev)
        next.delete(lockKey)
        return next
      })
    }
    return null
  }, [goals, showMessage])

  const deleteGoal = useCallback(async (goalId: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/goals/items?id=${goalId}`, { method: 'DELETE' })
      if (!res.ok) {
        return false
      }
      setGoals(prev => prev.filter(g => g.id !== goalId))
      return true
    } catch (error) {
      console.error('Error deleting goal:', error)
      showMessage('❌ Ошибка удаления цели')
      return false
    }
  }, [showMessage])

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
    // Toggle the goal at the specified level
    const trackedGoal = goals.find(g => g.periodKey === periodKey && fuzzyMatchGoal(g.text, text))
    
    if (trackedGoal) {
      await toggleGoalCompleted(trackedGoal.id, completed)
    } else {
      const newGoal = await createTrackedGoal(periodKey, text, 0)
      if (newGoal && completed) {
        await toggleGoalCompleted(newGoal.id, true)
      }
    }

    // Sync completion across month ↔ week levels
    const isWeekKey = /^\d{4}-\d{2}-W\d+$/.test(periodKey)
    const isMonthKey = /^\d{4}-\d{2}$/.test(periodKey)

    if (isWeekKey) {
      const monthKey = periodKey.slice(0, 7)
      const monthGoals = periodGoals.get(monthKey) || []
      const hasMonthGoal = monthGoals.some(g => fuzzyMatchGoal(g, text))
      if (hasMonthGoal) {
        const monthTracked = goals.find(g => g.periodKey === monthKey && fuzzyMatchGoal(g.text, text))
        if (monthTracked && monthTracked.completed !== completed) {
          await toggleGoalCompleted(monthTracked.id, completed)
        } else if (!monthTracked && completed) {
          const created = await createTrackedGoal(monthKey, text, 0)
          if (created) await toggleGoalCompleted(created.id, true)
        }
      }
    } else if (isMonthKey) {
      const weekGoalsFiltered = goals.filter(g => g.periodKey.startsWith(periodKey + '-W') && fuzzyMatchGoal(g.text, text))
      for (const wg of weekGoalsFiltered) {
        if (wg.completed !== completed) {
          await toggleGoalCompleted(wg.id, completed)
        }
      }
    }

    const freshGoals = await loadTrackedGoals()

    // Автозавершение: если все дочерние цели родителя завершены — завершить родителя
    if (completed && freshGoals.length > 0) {
      const resolvedGoal = freshGoals.find(g => g.periodKey === periodKey && fuzzyMatchGoal(g.text, text))
      if (resolvedGoal?.parentId) {
        const siblings = freshGoals.filter(g => g.parentId === resolvedGoal.parentId)
        const allSiblingsCompleted = siblings.length > 0 && siblings.every(g => g.id === resolvedGoal.id ? completed : g.completed)
        if (allSiblingsCompleted) {
          const parent = freshGoals.find(g => g.id === resolvedGoal.parentId)
          if (parent && !parent.completed) {
            await toggleGoalCompleted(parent.id, true)
            showMessage(`✅ Все подцели выполнены — родительская цель "${parent.text.slice(0, 40)}${parent.text.length > 40 ? '…' : ''}" тоже завершена`)
            await loadTrackedGoals()
          }
        }
      }
    }
  }, [goals, periodGoals, toggleGoalCompleted, createTrackedGoal, loadTrackedGoals, showMessage])

  const setGoalTags = useCallback(async (periodKey: string, text: string, newTags: string[]) => {
    const trackedGoal = goals.find(g => g.periodKey === periodKey && g.text === text)

    if (trackedGoal) {
      try {
        const res = await fetch('/api/goals/items', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: trackedGoal.id, tags: newTags }),
        })
        const updated = await res.json()
        setGoals(prev => prev.map(g => g.id === trackedGoal.id ? { ...g, tags: updated.tags || newTags } : g))
      } catch (error) {
        console.error('Error updating goal tags:', error)
        showMessage('❌ Ошибка обновления тегов')
      }
    } else {
      await createTrackedGoal(periodKey, text, 0, newTags)
    }
    await loadTrackedGoals()
  }, [goals, createTrackedGoal, loadTrackedGoals, showMessage])

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

  return {
    goals,
    loadTrackedGoals,
    toggleGoalCompleted,
    updateGoalPriority,
    setGoalPriority,
    setGoalCompleted,
    setGoalTags,
    createTrackedGoal,
    deleteGoal,
    processingGoals,
    tags,
    loadTags,
    createTag,
    deleteTag,
    calculatePeriodProgress,
  }
}
