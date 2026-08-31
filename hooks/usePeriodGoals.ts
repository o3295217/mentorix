'use client'

import { useState, useCallback } from 'react'
import { PeriodType, getPeriodDates } from '@/lib/dates'
import { getMonthWeeks, getPeriodKey } from '@/lib/goals-utils'
import type { YearGoalItem } from '@/lib/types'

export function usePeriodGoals(showMessage: (text: string) => void) {
  const [yearGoals, setYearGoals] = useState<Map<number, YearGoalItem[]>>(new Map())
  const [periodGoals, setPeriodGoals] = useState<Map<string, string[]>>(new Map())

  const setYearGoalsFromRecord = useCallback((goalsByYear: Record<string, YearGoalItem[]>) => {
    setYearGoals(new Map(Object.entries(goalsByYear).map(([year, goals]) => [Number(year), goals])))
  }, [])

  const mergePeriodGoalsFromRecord = useCallback((goalsByPeriod: Record<string, string[]>) => {
    setPeriodGoals(prev => {
      const next = new Map(prev)
      for (const [key, goals] of Object.entries(goalsByPeriod)) {
        next.set(key, goals)
      }
      return next
    })
  }, [])

  const loadYearGoalYears = useCallback(async (): Promise<number[]> => {
    try {
      const res = await fetch('/api/goals/year')
      const data = await res.json()
      return Array.isArray(data?.years) ? data.years : []
    } catch (error) {
      console.error('Error loading year goal years:', error)
      showMessage('Ошибка загрузки истории по годам')
      return []
    }
  }, [showMessage])

  // Year goals operations
  const loadYearGoals = useCallback(async (year: number) => {
    try {
      const res = await fetch(`/api/goals/year?year=${year}`)
      const data = await res.json()
      const goals: YearGoalItem[] = (data.goals || []).map((g: string | YearGoalItem) =>
        typeof g === 'string' ? { id: `yg_legacy_${Math.random().toString(36).slice(2, 8)}`, text: g } : g
      )
      setYearGoals(prev => new Map(prev).set(year, goals))
    } catch (error) {
      console.error(`Error loading goals for ${year}:`, error)
      showMessage(`Ошибка загрузки целей на ${year} год`)
    }
  }, [showMessage])

  const saveYearGoals = useCallback(async (year: number, goals: YearGoalItem[]) => {
    try {
      const res = await fetch('/api/goals/year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, goals }),
      })
      const data = await res.json()
      const saved: YearGoalItem[] = (data.goals || goals).map((g: string | YearGoalItem) =>
        typeof g === 'string' ? { id: `yg_${Math.random().toString(36).slice(2, 8)}`, text: g } : g
      )
      setYearGoals(prev => new Map(prev).set(year, saved))
      showMessage(`Цели на ${year} год сохранены!`)
    } catch (error) {
      console.error(`Error saving goals for ${year}:`, error)
      showMessage('Ошибка при сохранении')
    }
  }, [showMessage])

  const addYearGoal = useCallback((year: number, text: string) => {
    if (!text.trim()) return
    setYearGoals(prev => {
      const currentGoals = prev.get(year) || []
      const normalized = text.trim().toLowerCase()
      if (currentGoals.some(g => g.text.trim().toLowerCase() === normalized)) {
        showMessage('Такая цель уже есть')
        return prev
      }
      const newItem: YearGoalItem = { id: `yg_${Math.random().toString(36).slice(2, 8)}`, text: text.trim() }
      const updatedGoals = [...currentGoals, newItem]
      saveYearGoals(year, updatedGoals)
      return new Map(prev).set(year, updatedGoals)
    })
  }, [saveYearGoals, showMessage])

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
      updatedGoals[index] = { ...updatedGoals[index], text: text.trim() }
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
        key = getPeriodKey('week', date)
      }

      if (key && data?.goals) {
        const goalStrings: string[] = data.goals.map((g: string | { text: string }) =>
          typeof g === 'string' ? g : g.text
        )
        setPeriodGoals(prev => new Map(prev).set(key, goalStrings))
      }
    } catch (error) {
      console.error(`Error loading period goals:`, error)
      showMessage('Ошибка загрузки целей периода')
    }
  }, [showMessage])

  const loadAllWeeksForMonth = useCallback(async (year: number, month: number) => {
    // Недели месяца по ISO-правилу четверга: понедельник первой недели
    // может лежать в предыдущем месяце (2026-09-W1 = 31.08)
    await Promise.all(
      getMonthWeeks(year, month).map((week) => loadPeriodGoalsWithKey('week', week.start))
    )
  }, [loadPeriodGoalsWithKey])

  const savePeriodGoals = useCallback(async (periodType: PeriodType, date: Date, goals: string[], label: string) => {
    try {
      const { start, end } = getPeriodDates(date, periodType)
      let periodKey = ''
      if (periodType === 'quarter') {
        periodKey = `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`
      } else if (periodType === 'half_year') {
        periodKey = `${date.getFullYear()}-H${date.getMonth() < 6 ? 1 : 2}`
      } else if (periodType === 'month') {
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      } else if (periodType === 'week') {
        periodKey = getPeriodKey('week', date)
      }

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
      if (periodKey) {
        setPeriodGoals(prev => new Map(prev).set(periodKey, goals))
      }
      showMessage(`${label} сохранён`)
    } catch (error) {
      console.error(`Error saving period goals:`, error)
      showMessage('Ошибка при сохранении')
    }
  }, [showMessage])

  const addPeriodGoal = useCallback((periodKey: string, periodType: PeriodType, date: Date, label: string, text: string) => {
    if (!text.trim()) return
    setPeriodGoals(prev => {
      const currentGoals = prev.get(periodKey) || []
      const normalized = text.trim().toLowerCase()
      if (currentGoals.some(g => g.trim().toLowerCase() === normalized)) {
        showMessage('Такая цель уже есть')
        return prev
      }
      const updatedGoals = [...currentGoals, text.trim()]
      savePeriodGoals(periodType, date, updatedGoals, label)
      return new Map(prev).set(periodKey, updatedGoals)
    })
  }, [savePeriodGoals, showMessage])

  const addPeriodGoalBatch = useCallback((periodKey: string, periodType: PeriodType, date: Date, label: string, texts: string[]) => {
    const trimmed = texts.map(t => t.trim()).filter(t => t.length > 0)
    if (trimmed.length === 0) return
    setPeriodGoals(prev => {
      const currentGoals = prev.get(periodKey) || []
      const newGoals = trimmed.filter(text =>
        !currentGoals.some(g => g.trim().toLowerCase() === text.toLowerCase())
      )
      if (newGoals.length === 0) return prev
      const updatedGoals = [...currentGoals, ...newGoals]
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

  return {
    yearGoals,
    setYearGoalsFromRecord,
    loadYearGoalYears,
    loadYearGoals,
    saveYearGoals,
    addYearGoal,
    removeYearGoal,
    editYearGoal,
    periodGoals,
    mergePeriodGoalsFromRecord,
    loadPeriodGoalsWithKey,
    loadAllWeeksForMonth,
    savePeriodGoals,
    addPeriodGoal,
    addPeriodGoalBatch,
    removePeriodGoal,
    editPeriodGoal,
  }
}
