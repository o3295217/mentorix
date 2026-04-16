'use client'

import { useState, useCallback } from 'react'
import { PeriodType, getPeriodDates } from '@/lib/dates'

export function usePeriodGoals(showMessage: (text: string) => void) {
  const [yearGoals, setYearGoals] = useState<Map<number, string[]>>(new Map())
  const [periodGoals, setPeriodGoals] = useState<Map<string, string[]>>(new Map())

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
      setYearGoals(prev => new Map(prev).set(year, goals))
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
      const normalized = text.trim().toLowerCase()
      if (currentGoals.some(g => g.trim().toLowerCase() === normalized)) {
        showMessage('Такая цель уже есть')
        return prev
      }
      const updatedGoals = [...currentGoals, text.trim()]
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
        const goalStrings: string[] = data.goals.map((g: string | { text: string }) =>
          typeof g === 'string' ? g : g.text
        )
        setPeriodGoals(prev => new Map(prev).set(key, goalStrings))
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
      let periodKey = ''
      if (periodType === 'quarter') {
        periodKey = `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`
      } else if (periodType === 'half_year') {
        periodKey = `${date.getFullYear()}-H${date.getMonth() < 6 ? 1 : 2}`
      } else if (periodType === 'month') {
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
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
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-W${weekNum}`
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
    addPeriodGoalBatch,
    removePeriodGoal,
    editPeriodGoal,
  }
}
