'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PeriodType } from '@/lib/dates'
import { DreamGoal, DreamProgressSummary, Goal, GoalsContextResponse, GoalTag, YearGoalItem } from '@/lib/types'
import { useDreamGoal } from './useDreamGoal'
import { usePeriodGoals } from './usePeriodGoals'
import { useTrackedGoals } from './useTrackedGoals'

// Re-export types for backward compatibility
export type { DreamGoal, Goal, GoalTag, YearGoalItem } from '@/lib/types'

export interface UseGoalsReturn {
  // Dream
  dreamGoal: DreamGoal | null
  dreamProgress: DreamProgressSummary
  yearEvaluations: Record<number, { avg: number; count: number }>
  archivedYearGoalYears: number[]
  loadGoalsContext: (year: number) => Promise<void>
  saveDream: (text: string, months: number | null) => Promise<void>
  
  // Year goals
  yearGoals: Map<number, YearGoalItem[]>
  loadYearGoalYears: () => Promise<number[]>
  loadYearGoals: (year: number) => Promise<void>
  saveYearGoals: (year: number, goals: YearGoalItem[]) => Promise<void>
  addYearGoal: (year: number, text: string) => void
  removeYearGoal: (year: number, index: number) => void
  editYearGoal: (year: number, index: number, text: string) => void
  
  // Period goals
  periodGoals: Map<string, string[]>
  loadPeriodGoalsWithKey: (periodType: PeriodType, date: Date) => Promise<void>
  loadAllWeeksForMonth: (year: number, month: number) => Promise<void>
  savePeriodGoals: (periodType: PeriodType, date: Date, goals: string[], label: string) => Promise<void>
  addPeriodGoal: (periodKey: string, periodType: PeriodType, date: Date, label: string, text: string) => void
  addPeriodGoalBatch: (periodKey: string, periodType: PeriodType, date: Date, label: string, texts: string[]) => void
  removePeriodGoal: (periodKey: string, index: number, periodType: PeriodType, date: Date, label: string) => void
  editPeriodGoal: (periodKey: string, index: number, periodType: PeriodType, date: Date, label: string, text: string) => void
  
  // Tracked goals (with completion, priority, etc.)
  goals: Goal[]
  loadTrackedGoals: () => Promise<Goal[]>
  toggleGoalCompleted: (goalId: number, completed: boolean) => Promise<void>
  updateGoalPriority: (goalId: number, priority: number) => Promise<void>
  setGoalPriority: (periodKey: string, text: string, priority: number) => Promise<void>
  setGoalCompleted: (periodKey: string, text: string, completed: boolean) => Promise<void>
  setGoalTags: (periodKey: string, text: string, tags: string[]) => Promise<void>
  createTrackedGoal: (periodKey: string, text: string, priority?: number, tags?: string[], parentId?: number | null, scope?: string | null, rootYearGoalId?: string | null) => Promise<Goal | null>
  deleteGoal: (goalId: number) => Promise<boolean>
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
  const [message, setMessage] = useState('')
  const [dreamProgress, setDreamProgress] = useState<DreamProgressSummary>({ total: 0, completed: 0, percent: 0 })
  const [yearEvaluations, setYearEvaluations] = useState<Record<number, { avg: number; count: number }>>({})
  const [archivedYearGoalYears, setArchivedYearGoalYears] = useState<number[]>([])
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentYear = new Date().getFullYear()

  const showMessage = useCallback((text: string) => {
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

  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current)
    }
  }, [])

  const dream = useDreamGoal(showMessage)
  const period = usePeriodGoals(showMessage)
  const tracked = useTrackedGoals(showMessage, period.periodGoals)

  const loadGoalsContext = useCallback(async (year: number) => {
    try {
      const res = await fetch(`/api/goals/context?year=${year}`)
      if (!res.ok) throw new Error(`Failed to load goals context: ${res.status}`)

      const context = await res.json() as GoalsContextResponse
      dream.setDreamGoal(context.dreamGoal)
      period.setYearGoalsFromRecord(context.yearGoals)
      period.mergePeriodGoalsFromRecord(context.periodGoals)
      tracked.setGoals(context.goals)
      tracked.setTags(context.tags)
      setDreamProgress(context.dreamProgress)
      setYearEvaluations(
        Object.fromEntries(Object.entries(context.yearEvaluations).map(([contextYear, value]) => [Number(contextYear), value]))
      )
      setArchivedYearGoalYears(context.archivedYearGoalYears)
    } catch (error) {
      console.error('Error loading goals context:', error)
      showMessage('❌ Ошибка загрузки карты целей')
    }
  }, [dream.setDreamGoal, period.setYearGoalsFromRecord, period.mergePeriodGoalsFromRecord, tracked.setGoals, tracked.setTags, showMessage])

  return {
    // Dream
    dreamGoal: dream.dreamGoal,
    dreamProgress,
    yearEvaluations,
    archivedYearGoalYears,
    loadGoalsContext,
    saveDream: dream.saveDream,
    // Year goals
    yearGoals: period.yearGoals,
    loadYearGoalYears: period.loadYearGoalYears,
    loadYearGoals: period.loadYearGoals,
    saveYearGoals: period.saveYearGoals,
    addYearGoal: period.addYearGoal,
    removeYearGoal: period.removeYearGoal,
    editYearGoal: period.editYearGoal,
    // Period goals
    periodGoals: period.periodGoals,
    loadPeriodGoalsWithKey: period.loadPeriodGoalsWithKey,
    loadAllWeeksForMonth: period.loadAllWeeksForMonth,
    savePeriodGoals: period.savePeriodGoals,
    addPeriodGoal: period.addPeriodGoal,
    addPeriodGoalBatch: period.addPeriodGoalBatch,
    removePeriodGoal: period.removePeriodGoal,
    editPeriodGoal: period.editPeriodGoal,
    // Tracked goals
    goals: tracked.goals,
    loadTrackedGoals: tracked.loadTrackedGoals,
    toggleGoalCompleted: tracked.toggleGoalCompleted,
    updateGoalPriority: tracked.updateGoalPriority,
    setGoalPriority: tracked.setGoalPriority,
    setGoalCompleted: tracked.setGoalCompleted,
    setGoalTags: tracked.setGoalTags,
    createTrackedGoal: tracked.createTrackedGoal,
    deleteGoal: tracked.deleteGoal,
    processingGoals: tracked.processingGoals,
    // Tags
    tags: tracked.tags,
    createTag: tracked.createTag,
    deleteTag: tracked.deleteTag,
    // Progress
    calculatePeriodProgress: tracked.calculatePeriodProgress,
    // Utility
    showMessage,
    message,
    currentYear,
  }
}
