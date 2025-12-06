'use client'

import { useState, useEffect, useMemo } from 'react'
import { getPeriodDates, getPeriodName, PeriodType } from '@/lib/dates'

interface DreamGoal {
  id: number
  goalText: string
  years: number
}

interface YearGoals {
  year: number
  goals: string[]
}

// Интерфейс для Goal с полным трекингом
interface Goal {
  id: number
  text: string
  periodType: string
  periodKey: string
  completed: boolean
  completedAt: string | null
  deadline: string | null
  priority: number // 0=нет, 1=низкий, 2=средний, 3=высокий
  tags: string[]
  blockedBy: number[]
  history: { action: string; date: string; from?: string; to?: string }[]
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface GoalTag {
  id: number
  name: string
  color: string
}

export default function GoalsPage() {
  const [dreamGoal, setDreamGoal] = useState<DreamGoal | null>(null)
  const [dreamText, setDreamText] = useState('')
  const [dreamYears, setDreamYears] = useState(5)

  // Состояния для годов
  const [yearGoals, setYearGoals] = useState<Map<number, string[]>>(new Map())
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set([new Date().getFullYear()]))

  // Состояния для периодов внутри года
  const [periodGoals, setPeriodGoals] = useState<Map<string, string[]>>(new Map())
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set())

  // НОВОЕ: Состояния для целей с трекингом
  const [goals, setGoals] = useState<Goal[]>([])
  const [tags, setTags] = useState<GoalTag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6B7280')
  const [processingGoals, setProcessingGoals] = useState<Set<string>>(new Set()) // Блокировка повторных кликов

  // Фильтры и поиск
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all')
  const [filterPriority, setFilterPriority] = useState<number | null>(null)
  const [filterTag, setFilterTag] = useState<string | null>(null)

  // Состояния для полей ввода новых целей
  const [newGoalInputs, setNewGoalInputs] = useState<Map<string, string>>(new Map())

  // Состояние для редактирования целей (ключ: "year-2025-0" или "period-key-0")
  const [editingGoal, setEditingGoal] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')

  // Показывать все периоды (включая пустые)
  const [showAllPeriods, setShowAllPeriods] = useState(false)

  // Состояние для dropdown копирования
  const [copyDropdown, setCopyDropdown] = useState<string | null>(null)

  // Состояние для свёрнутых месяцев (по умолчанию развёрнуты)
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())

  // Состояние для развёрнутых длинных целей
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set())

  // Состояние для drag-and-drop
  const [draggedGoal, setDraggedGoal] = useState<{ weekKey: string; index: number; goal: string } | null>(null)
  const [dragOverWeek, setDragOverWeek] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const currentYear = new Date().getFullYear()

  useEffect(() => {
    loadDream()
    loadTags()
    loadTrackedGoals()
  }, [])

  // Загрузка tracked целей из новой модели Goal
  const loadTrackedGoals = async () => {
    try {
      const res = await fetch('/api/goals/items')
      const data = await res.json()
      if (Array.isArray(data)) {
        setGoals(data)
      }
    } catch (error) {
      console.error('Error loading tracked goals:', error)
    }
  }

  // Глобальные горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape - отмена редактирования
      if (e.key === 'Escape') {
        if (editingGoal) {
          setEditingGoal(null)
          setEditingText('')
        }
        if (copyDropdown) {
          setCopyDropdown(null)
        }
      }
      
      // Ctrl/Cmd + F - фокус на поиск
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        const searchInput = document.querySelector('input[placeholder*="Поиск"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
        }
      }
      
      // Ctrl/Cmd + / - показать справку (можно расширить)
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        showMessage('⌨️ Горячие клавиши: Esc=отмена, Ctrl+F=поиск, Enter=сохранить')
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editingGoal, copyDropdown])

  // Закрытие dropdown при клике вне
  useEffect(() => {
    const handleClickOutside = () => {
      if (copyDropdown) setCopyDropdown(null)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [copyDropdown])

  useEffect(() => {
    if (dreamGoal) {
      // Загружаем цели для всех годов в горизонте мечты
      const years = Array.from({ length: dreamGoal.years }, (_, i) => currentYear + i)
      years.forEach(year => loadYearGoals(year))

      const today = new Date()
      const currentMonth = today.getMonth()
      const currentQuarter = Math.floor(currentMonth / 3) + 1
      const quarterKey = `${currentYear}-Q${currentQuarter}`

      // Автоматически раскрыть текущий квартал
      setExpandedPeriods(prev => new Set(prev).add(quarterKey))

      // Загрузить ВСЕ кварталы текущего года
      for (let q = 1; q <= 4; q++) {
        loadPeriodGoalsWithKey('quarter', new Date(currentYear, (q - 1) * 3, 1))
      }

      // Загрузить ВСЕ месяцы текущего года
      for (let m = 0; m < 12; m++) {
        loadPeriodGoalsWithKey('month', new Date(currentYear, m, 1))
      }

      // Загрузить ВСЕ недели текущего месяца
      loadAllWeeksForMonth(currentYear, currentMonth)
    }
  }, [dreamGoal])

  const loadDream = async () => {
    try {
      const res = await fetch('/api/goals/dream')
      const data = await res.json()
      if (data) {
        setDreamGoal(data)
        setDreamText(data.goalText)
        setDreamYears(data.years)
      }
    } catch (error) {
      console.error('Error loading dream:', error)
    }
  }

  // Загрузка тегов
  const loadTags = async () => {
    try {
      const res = await fetch('/api/goals/tags')
      const data = await res.json()
      setTags(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading tags:', error)
      setTags([])
    }
  }

  // Создание тега
  const createTag = async () => {
    if (!newTagName.trim()) return
    try {
      const res = await fetch('/api/goals/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
      })
      const tag = await res.json()
      setTags(prev => [...prev, tag])
      setNewTagName('')
      showMessage('✅ Тег создан')
    } catch (error) {
      console.error('Error creating tag:', error)
    }
  }

  // Удаление тега
  const deleteTag = async (id: number) => {
    try {
      await fetch(`/api/goals/tags?id=${id}`, { method: 'DELETE' })
      setTags(prev => prev.filter(t => t.id !== id))
      showMessage('🗑️ Тег удалён')
    } catch (error) {
      console.error('Error deleting tag:', error)
    }
  }

  // Переключение выполнения цели
  const toggleGoalCompleted = async (goalId: number, completed: boolean) => {
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
    }
  }

  // Обновление приоритета цели
  const updateGoalPriority = async (goalId: number, priority: number) => {
    try {
      const res = await fetch('/api/goals/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: goalId, priority }),
      })
      const updated = await res.json()
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, priority: updated.priority } : g))
      showMessage(`✅ Приоритет: ${getPriorityIcon(priority)}`)
    } catch (error) {
      console.error('Error updating priority:', error)
    }
  }

  // Установить приоритет (найти или создать цель)
  const setGoalPriority = async (periodKey: string, text: string, priority: number) => {
    // Сначала ищем существующую цель
    let trackedGoal = goals.find(g => 
      g.periodKey === periodKey && 
      (g.text === text || g.text.startsWith(text.slice(0, 30)) || text.startsWith(g.text.slice(0, 30)))
    )
    
    if (trackedGoal) {
      await updateGoalPriority(trackedGoal.id, priority)
    } else {
      // Создаём новую
      await createTrackedGoal(periodKey, text, priority)
    }
    // Перезагружаем goals чтобы гарантировать актуальность
    await loadTrackedGoals()
  }

  // Переключить выполнение (найти или создать цель)
  const setGoalCompleted = async (periodKey: string, text: string, completed: boolean) => {
    let trackedGoal = goals.find(g => 
      g.periodKey === periodKey && 
      (g.text === text || g.text.startsWith(text.slice(0, 30)) || text.startsWith(g.text.slice(0, 30)))
    )
    
    if (trackedGoal) {
      await toggleGoalCompleted(trackedGoal.id, completed)
    } else {
      // Создаём новую и отмечаем выполненной
      const newGoal = await createTrackedGoal(periodKey, text, 0)
      if (newGoal && completed) {
        await toggleGoalCompleted(newGoal.id, true)
      }
    }
    // Перезагружаем goals
    await loadTrackedGoals()
  }

  // Обновление дедлайна цели
  const updateGoalDeadline = async (goalId: number, deadline: string | null) => {
    try {
      const res = await fetch('/api/goals/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: goalId, deadline }),
      })
      const updated = await res.json()
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, deadline: updated.deadline } : g))
    } catch (error) {
      console.error('Error updating deadline:', error)
    }
  }

  // Обновление тегов цели
  const updateGoalTags = async (goalId: number, tagsList: string[]) => {
    try {
      const res = await fetch('/api/goals/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: goalId, tags: tagsList }),
      })
      const updated = await res.json()
      // API уже возвращает tags как массив
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, tags: updated.tags } : g))
    } catch (error) {
      console.error('Error updating tags:', error)
    }
  }

  // Создание цели с трекингом (для существующих задач)
  const createTrackedGoal = async (periodKey: string, text: string, priority: number = 0, deadline: string | null = null): Promise<Goal | null> => {
    const lockKey = `${periodKey}-${text}`
    
    // Проверяем блокировку
    if (processingGoals.has(lockKey)) {
      return null
    }
    
    // Проверяем, может цель уже существует (из-за асинхронности)
    const existingGoal = goals.find(g => g.periodKey === periodKey && g.text === text)
    if (existingGoal) {
      return existingGoal
    }
    
    setProcessingGoals(prev => new Set(prev).add(lockKey))
    
    try {
      // Определяем тип периода по ключу
      let periodType = 'week'
      if (periodKey.includes('-Q')) periodType = 'quarter'
      else if (periodKey.match(/^\d{4}-\d{2}$/) ) periodType = 'month'
      else if (periodKey.includes('-W')) periodType = 'week'
      
      const res = await fetch('/api/goals/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, periodType, periodKey, priority, deadline }),
      })
      const newGoal = await res.json()
      if (newGoal.id) {
        // API уже возвращает tags, blockedBy, history как массивы
        setGoals(prev => [...prev, newGoal])
        if (priority > 0) {
          showMessage(`✅ Приоритет установлен: ${getPriorityIcon(priority)}`)
        }
        return newGoal
      }
    } catch (error) {
      console.error('Error creating tracked goal:', error)
    } finally {
      setProcessingGoals(prev => {
        const next = new Set(prev)
        next.delete(lockKey)
        return next
      })
    }
    return null
  }

  // Создание цели и сразу отметка выполнения
  const createTrackedGoalAndComplete = async (periodKey: string, text: string) => {
    const newGoal = await createTrackedGoal(periodKey, text, 0, null)
    if (newGoal) {
      await toggleGoalCompleted(newGoal.id, true)
    }
  }

  // Получить или создать tracked goal
  const getOrCreateTrackedGoal = async (periodKey: string, text: string): Promise<Goal | null> => {
    const existing = goals.find(g => g.periodKey === periodKey && g.text === text)
    if (existing) return existing
    return await createTrackedGoal(periodKey, text, 0, null)
  }

  // Проверка просроченности дедлайна
  const isOverdue = (deadline: string | null): boolean => {
    if (!deadline) return false
    return new Date(deadline) < new Date()
  }

  // Получить цвет приоритета
  const getPriorityColor = (priority: number): string => {
    switch (priority) {
      case 2: return 'text-red-500'
      case 1: return 'text-yellow-500'
      default: return 'text-gray-400'
    }
  }

  // Получить иконку приоритета
  const getPriorityIcon = (priority: number): string => {
    switch (priority) {
      case 2: return '🔴'
      case 1: return '🟡'
      default: return '⚪'
    }
  }

  // Вычисление прогресса периода (на основе periodGoals - списка целей)
  const calculatePeriodProgress = (periodKey: string): { total: number; completed: number; percent: number } => {
    // Считаем от общего количества целей в periodGoals
    const periodGoalsList = periodGoals.get(periodKey) || []
    const total = periodGoalsList.length
    // Считаем выполненные - те, что есть в goals и отмечены как completed
    const completed = periodGoalsList.filter(goalText => {
      const trackedGoal = goals.find(g => g.periodKey === periodKey && g.text === goalText)
      return trackedGoal?.completed
    }).length
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, percent }
  }

  const loadYearGoals = async (year: number) => {
    try {
      const res = await fetch(`/api/goals/year?year=${year}`)
      const data = await res.json()
      setYearGoals(prev => new Map(prev).set(year, data.goals || []))
    } catch (error) {
      console.error(`Error loading goals for ${year}:`, error)
    }
  }

  const loadPeriodGoalsWithKey = async (periodType: PeriodType, date: Date) => {
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
        let current = new Date(firstDay)
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
    }
  }

  // Загрузить все недели месяца
  const loadAllWeeksForMonth = async (year: number, month: number) => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    let current = new Date(firstDay)
    while (current.getDay() !== 1) {
      current.setDate(current.getDate() + 1)
    }
    
    let weekNum = 1
    while (current <= lastDay) {
      const weekStart = new Date(current)
      loadPeriodGoalsWithKey('week', weekStart)
      current.setDate(current.getDate() + 7)
      weekNum++
    }
  }

  const saveDream = async () => {
    setSaving(true)
    try {
      await fetch('/api/goals/dream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalText: dreamText, years: dreamYears }),
      })
      await loadDream()
      showMessage('✅ Мечта сохранена!')
    } catch (error) {
      console.error('Error saving dream:', error)
      showMessage('❌ Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  const saveYearGoals = async (year: number, goals: string[]) => {
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
  }

  const savePeriodGoals = async (periodType: PeriodType, date: Date, goals: string[], label: string) => {
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
  }

  const addYearGoal = (year: number) => {
    const key = `year-${year}`
    const input = newGoalInputs.get(key) || ''
    if (!input.trim()) return

    const currentGoals = yearGoals.get(year) || []
    const updatedGoals = [...currentGoals, input.trim()]
    setYearGoals(prev => new Map(prev).set(year, updatedGoals))
    setNewGoalInputs(prev => new Map(prev).set(key, ''))
    saveYearGoals(year, updatedGoals)
  }

  const removeYearGoal = (year: number, index: number) => {
    const currentGoals = yearGoals.get(year) || []
    const updatedGoals = currentGoals.filter((_, i) => i !== index)
    setYearGoals(prev => new Map(prev).set(year, updatedGoals))
    saveYearGoals(year, updatedGoals)
  }

  const startEditYearGoal = (year: number, index: number, text: string) => {
    setEditingGoal(`year-${year}-${index}`)
    setEditingText(text)
  }

  const saveEditYearGoal = (year: number, index: number) => {
    if (!editingText.trim()) {
      // Если текст пустой, удаляем цель
      removeYearGoal(year, index)
    } else {
      const currentGoals = yearGoals.get(year) || []
      const updatedGoals = [...currentGoals]
      updatedGoals[index] = editingText.trim()
      setYearGoals(prev => new Map(prev).set(year, updatedGoals))
      saveYearGoals(year, updatedGoals)
    }
    setEditingGoal(null)
    setEditingText('')
  }

  const addPeriodGoal = (periodKey: string, periodType: PeriodType, date: Date, label: string) => {
    const input = newGoalInputs.get(periodKey) || ''
    if (!input.trim()) return

    const currentGoals = periodGoals.get(periodKey) || []
    const updatedGoals = [...currentGoals, input.trim()]
    setPeriodGoals(prev => new Map(prev).set(periodKey, updatedGoals))
    setNewGoalInputs(prev => new Map(prev).set(periodKey, ''))
    savePeriodGoals(periodType, date, updatedGoals, label)
  }

  const removePeriodGoal = (periodKey: string, index: number, periodType: PeriodType, date: Date, label: string) => {
    const currentGoals = periodGoals.get(periodKey) || []
    const updatedGoals = currentGoals.filter((_, i) => i !== index)
    setPeriodGoals(prev => new Map(prev).set(periodKey, updatedGoals))
    savePeriodGoals(periodType, date, updatedGoals, label)
  }

  const startEditPeriodGoal = (periodKey: string, index: number, text: string) => {
    setEditingGoal(`period-${periodKey}-${index}`)
    setEditingText(text)
  }

  const saveEditPeriodGoal = (periodKey: string, index: number, periodType: PeriodType, date: Date, label: string) => {
    if (!editingText.trim()) {
      // Если текст пустой, удаляем цель
      removePeriodGoal(periodKey, index, periodType, date, label)
    } else {
      const currentGoals = periodGoals.get(periodKey) || []
      const updatedGoals = [...currentGoals]
      updatedGoals[index] = editingText.trim()
      setPeriodGoals(prev => new Map(prev).set(periodKey, updatedGoals))
      savePeriodGoals(periodType, date, updatedGoals, label)
    }
    setEditingGoal(null)
    setEditingText('')
  }

  // Проверка на дубликат (нечёткое сравнение - игнорирует регистр и пробелы)
  const isDuplicate = (goals: string[], newGoal: string): boolean => {
    const normalize = (s: string) => s.toLowerCase().trim()
    return goals.some(g => normalize(g) === normalize(newGoal))
  }

  // Копирование цели года в квартал
  const copyYearGoalToQuarter = (year: number, goalText: string, quarter: number) => {
    const quarterKey = `${year}-Q${quarter}`
    const quarterDate = new Date(year, (quarter - 1) * 3, 1)
    const currentGoals = periodGoals.get(quarterKey) || []
    
    // Проверка на дубликат
    if (isDuplicate(currentGoals, goalText)) {
      if (!confirm(`⚠️ Цель "${goalText}" уже есть в Q${quarter}.\n\nВсё равно добавить?`)) {
        setCopyDropdown(null)
        return
      }
    }
    
    const updatedGoals = [...currentGoals, goalText]
    setPeriodGoals(prev => new Map(prev).set(quarterKey, updatedGoals))
    savePeriodGoals('quarter', quarterDate, updatedGoals, `Q${quarter} ${year}`)
    setCopyDropdown(null)
    showMessage(`✅ Скопировано в Q${quarter}`)
  }

  // Копирование цели года в месяц (новая функция)
  const copyYearGoalToMonth = (year: number, goalText: string, month: number) => {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
    const monthDate = new Date(year, month, 1)
    const currentGoals = periodGoals.get(monthKey) || []
    
    // Проверка на дубликат
    if (isDuplicate(currentGoals, goalText)) {
      if (!confirm(`⚠️ Цель "${goalText}" уже есть в ${monthNames[month]}.\n\nВсё равно добавить?`)) {
        setCopyDropdown(null)
        return
      }
    }
    
    const updatedGoals = [...currentGoals, goalText]
    setPeriodGoals(prev => new Map(prev).set(monthKey, updatedGoals))
    savePeriodGoals('month', monthDate, updatedGoals, monthNames[month])
    setCopyDropdown(null)
    showMessage(`✅ Скопировано в ${monthNames[month]}`)
  }

  // Копирование цели года в неделю
  const copyYearGoalToWeek = (year: number, goalText: string, month: number, weekNum: number, weekStart: Date) => {
    const weekKey = `${year}-${String(month + 1).padStart(2, '0')}-W${weekNum}`
    const currentGoals = periodGoals.get(weekKey) || []
    
    // Проверка на дубликат
    if (isDuplicate(currentGoals, goalText)) {
      if (!confirm(`⚠️ Цель "${goalText}" уже есть в Неделе ${weekNum} ${monthNames[month]}.\n\nВсё равно добавить?`)) {
        setCopyDropdown(null)
        return
      }
    }
    
    const updatedGoals = [...currentGoals, goalText]
    setPeriodGoals(prev => new Map(prev).set(weekKey, updatedGoals))
    savePeriodGoals('week', weekStart, updatedGoals, `Неделя ${weekNum}`)
    setCopyDropdown(null)
    showMessage(`✅ Скопировано в Неделю ${weekNum} ${monthNames[month]}`)
  }

  // Копирование цели квартала в месяц
  const copyQuarterGoalToMonth = (year: number, quarter: number, goalText: string, month: number) => {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
    const monthDate = new Date(year, month, 1)
    const currentGoals = periodGoals.get(monthKey) || []
    
    // Проверка на дубликат
    if (isDuplicate(currentGoals, goalText)) {
      if (!confirm(`⚠️ Цель "${goalText}" уже есть в ${monthNames[month]}.\n\nВсё равно добавить?`)) {
        setCopyDropdown(null)
        return
      }
    }
    
    const updatedGoals = [...currentGoals, goalText]
    setPeriodGoals(prev => new Map(prev).set(monthKey, updatedGoals))
    savePeriodGoals('month', monthDate, updatedGoals, monthNames[month])
    setCopyDropdown(null)
    showMessage(`✅ Скопировано в ${monthNames[month]}`)
  }

  // Копирование цели квартала в неделю (новая функция)
  const copyQuarterGoalToWeek = (year: number, goalText: string, month: number, weekNum: number, weekStart: Date) => {
    const weekKey = `${year}-${String(month + 1).padStart(2, '0')}-W${weekNum}`
    const currentGoals = periodGoals.get(weekKey) || []
    
    // Проверка на дубликат
    if (isDuplicate(currentGoals, goalText)) {
      if (!confirm(`⚠️ Цель "${goalText}" уже есть в Неделе ${weekNum} ${monthNames[month]}.\n\nВсё равно добавить?`)) {
        setCopyDropdown(null)
        return
      }
    }
    
    const updatedGoals = [...currentGoals, goalText]
    setPeriodGoals(prev => new Map(prev).set(weekKey, updatedGoals))
    savePeriodGoals('week', weekStart, updatedGoals, `Неделя ${weekNum}`)
    setCopyDropdown(null)
    showMessage(`✅ Скопировано в Неделю ${weekNum} ${monthNames[month]}`)
  }

  // Копирование цели месяца в неделю
  const copyMonthGoalToWeek = (year: number, month: number, goalText: string, weekNum: number, weekStart: Date) => {
    const weekKey = `${year}-${String(month + 1).padStart(2, '0')}-W${weekNum}`
    const currentGoals = periodGoals.get(weekKey) || []
    
    // Проверка на дубликат
    if (isDuplicate(currentGoals, goalText)) {
      if (!confirm(`⚠️ Цель "${goalText}" уже есть в Неделе ${weekNum}.\n\nВсё равно добавить?`)) {
        setCopyDropdown(null)
        return
      }
    }
    
    const updatedGoals = [...currentGoals, goalText]
    setPeriodGoals(prev => new Map(prev).set(weekKey, updatedGoals))
    savePeriodGoals('week', weekStart, updatedGoals, `Неделя ${weekNum}`)
    setCopyDropdown(null)
    showMessage(`✅ Скопировано в Неделю ${weekNum}`)
  }

  const toggleYear = (year: number) => {
    const newExpanded = new Set(expandedYears)
    if (newExpanded.has(year)) {
      newExpanded.delete(year)
    } else {
      newExpanded.add(year)
    }
    setExpandedYears(newExpanded)
  }

  const showMessage = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(''), 3000)
  }

  // Функция "подмигивания" элемента
  const blinkElement = (el: HTMLElement) => {
    el.classList.add('animate-blink')
    setTimeout(() => el.classList.remove('animate-blink'), 1500)
  }

  // Скролл к элементу с подмигиванием
  const scrollToAndBlink = (elementId: string, delay: number = 150) => {
    setTimeout(() => {
      const el = document.getElementById(elementId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => blinkElement(el), 500)
      }
    }, delay)
  }

  // Перемещение задачи между неделями
  const moveGoalBetweenWeeks = (fromWeekKey: string, toWeekKey: string, goalIndex: number, goalText: string) => {
    if (fromWeekKey === toWeekKey) return

    // Удаляем из исходной недели
    const fromGoals = periodGoals.get(fromWeekKey) || []
    const updatedFromGoals = fromGoals.filter((_, i) => i !== goalIndex)

    // Добавляем в целевую неделю
    const toGoals = periodGoals.get(toWeekKey) || []
    const updatedToGoals = [...toGoals, goalText]

    // Обновляем state
    setPeriodGoals(prev => {
      const next = new Map(prev)
      next.set(fromWeekKey, updatedFromGoals)
      next.set(toWeekKey, updatedToGoals)
      return next
    })

    // Сохраняем обе недели
    const parseWeekKey = (key: string) => {
      const parts = key.split('-') // 2025-12-W1
      const year = parseInt(parts[0])
      const month = parseInt(parts[1]) - 1
      const weekNum = parseInt(parts[2].replace('W', ''))
      
      const firstDay = new Date(year, month, 1)
      let current = new Date(firstDay)
      while (current.getDay() !== 1) current.setDate(current.getDate() + 1)
      for (let i = 1; i < weekNum; i++) current.setDate(current.getDate() + 7)
      return { weekStart: current, weekNum }
    }

    const fromParsed = parseWeekKey(fromWeekKey)
    const toParsed = parseWeekKey(toWeekKey)

    savePeriodGoals('week', fromParsed.weekStart, updatedFromGoals, `Неделя ${fromParsed.weekNum}`)
    savePeriodGoals('week', toParsed.weekStart, updatedToGoals, `Неделя ${toParsed.weekNum}`)

    showMessage(`✅ Задача перемещена в W${toParsed.weekNum}`)
  }

  const getYearDistance = (year: number) => year - currentYear

  const getDetailLevel = (year: number): 'month' | 'quarter' | 'half' | 'year' => {
    const distance = getYearDistance(year)
    if (distance === 0) return 'month'
    if (distance === 1) return 'quarter'
    if (distance <= 3) return 'half'
    return 'year'
  }

  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Управление целями</h1>

      {/* Панель поиска и фильтров */}
      <div className="card bg-white border border-gray-200">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Поиск */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Поиск целей..."
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
            />
          </div>
          
          {/* Фильтр по статусу */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'completed')}
            className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="all">📋 Все</option>
            <option value="active">⏳ Активные</option>
            <option value="completed">✅ Выполненные</option>
          </select>
          
          {/* Фильтр по приоритету */}
          <select
            value={filterPriority ?? ''}
            onChange={(e) => setFilterPriority(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">🎯 Все приоритеты</option>
            <option value="3">🔴 Высокий</option>
            <option value="2">🟡 Средний</option>
            <option value="1">🟢 Низкий</option>
            <option value="0">⚪ Без приоритета</option>
          </select>
          
          {/* Фильтр по тегу */}
          <select
            value={filterTag ?? ''}
            onChange={(e) => setFilterTag(e.target.value || null)}
            className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">🏷️ Все теги</option>
            {(tags || []).map(tag => (
              <option key={tag.id} value={tag.name}>{tag.name}</option>
            ))}
          </select>
        </div>
        
        {/* Управление тегами */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-500 font-medium">Теги:</span>
            {(tags || []).map(tag => (
              <span 
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}` }}
              >
                {tag.name}
                <button 
                  onClick={() => deleteTag(tag.id)}
                  className="ml-1 hover:opacity-70"
                >
                  ✕
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1 ml-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createTag()}
                placeholder="Новый тег..."
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg w-24 focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer"
              />
              <button
                onClick={createTag}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Мечта */}
      <div className="card bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200">
        <h2 className="text-2xl font-bold mb-4 text-purple-900">🎯 Мечта</h2>

        <div className="space-y-4">
          <div>
            <label className="block">
              <span className="text-gray-700 font-medium mb-2 block">Горизонт планирования (лет):</span>
              <select
                value={dreamYears}
                onChange={(e) => setDreamYears(parseInt(e.target.value))}
                className="input w-48"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(y => (
                  <option key={y} value={y}>{y} {y === 1 ? 'год' : y < 5 ? 'года' : 'лет'}</option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <label className="block">
              <span className="text-gray-700 font-medium mb-2 block">
                Главная цель на {dreamYears} {dreamYears === 1 ? 'год' : dreamYears < 5 ? 'года' : 'лет'}:
              </span>
              <textarea
                value={dreamText}
                onChange={(e) => setDreamText(e.target.value)}
                className="textarea resize-y"
                placeholder="Например: Стать основателем и CEO успешной IT-компании с командой 50+ человек..."
                rows={8}
              />
            </label>
          </div>

          <button onClick={saveDream} disabled={saving} className="btn-primary">
            {saving ? 'Сохранение...' : 'Сохранить мечту'}
          </button>
        </div>
      </div>

      {/* Иерархическое дерево целей */}
      {dreamGoal && (
        <div className="card bg-gradient-to-br from-slate-50 to-blue-50">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-2 rounded-lg">📊</span>
            План достижения мечты
          </h2>

          <div className="space-y-3">
            {Array.from({ length: dreamGoal.years }, (_, i) => {
              const year = currentYear + i
              const distance = getYearDistance(year)
              const isExpanded = expandedYears.has(year)
              const yearGoalsList = yearGoals.get(year) || []
              const detailLevel = getDetailLevel(year)
              const yearKey = `year-${year}`

              // Цветовая схема в зависимости от удалённости года
              const yearColors = distance === 0 
                ? 'from-emerald-500 to-teal-500 border-emerald-300 bg-emerald-50'
                : distance === 1 
                ? 'from-blue-500 to-cyan-500 border-blue-300 bg-blue-50'
                : distance <= 3
                ? 'from-purple-500 to-pink-500 border-purple-300 bg-purple-50'
                : 'from-amber-500 to-orange-500 border-amber-300 bg-amber-50'

              return (
                <div key={year} className={`rounded-xl border-2 ${distance === 0 ? 'border-emerald-200' : distance === 1 ? 'border-blue-200' : distance <= 3 ? 'border-purple-200' : 'border-amber-200'} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}>
                  {/* Заголовок года */}
                  <button
                    onClick={() => toggleYear(year)}
                    className={`w-full px-4 py-3 flex items-center justify-between ${distance === 0 ? 'bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100' : distance === 1 ? 'bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100' : distance <= 3 ? 'bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100' : 'bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100'} transition-colors`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-10 h-10 rounded-lg bg-gradient-to-br ${yearColors.split(' ')[0]} ${yearColors.split(' ')[1]} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <div className="text-left">
                        <span className="font-bold text-lg block">
                          🎯 {year} {distance === 0 && <span className="text-emerald-600 text-sm font-normal">(текущий)</span>}
                        </span>
                        <span className={`text-sm ${distance === 0 ? 'text-emerald-600' : distance === 1 ? 'text-blue-600' : distance <= 3 ? 'text-purple-600' : 'text-amber-600'}`}>
                          {yearGoalsList.length > 0 ? `${yearGoalsList.length} ${yearGoalsList.length === 1 ? 'цель' : yearGoalsList.length < 5 ? 'цели' : 'целей'}` : 'Добавьте цели →'}
                        </span>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${distance === 0 ? 'bg-emerald-100 text-emerald-700' : distance === 1 ? 'bg-blue-100 text-blue-700' : distance <= 3 ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                      {distance === 0 ? 'Сейчас' : `+${distance} ${distance === 1 ? 'год' : distance < 5 ? 'года' : 'лет'}`}
                    </div>
                  </button>

                  {/* Содержимое года */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4 bg-white">
                      {/* Цели на год */}
                      <div className="pt-4">
                        <h4 className={`font-semibold mb-3 flex items-center gap-2 ${distance === 0 ? 'text-emerald-700' : distance === 1 ? 'text-blue-700' : distance <= 3 ? 'text-purple-700' : 'text-amber-700'}`}>
                          <span className="text-lg">🎯</span>
                          Цели на {year} год:
                        </h4>

                        {/* Поле добавления новой цели */}
                        <div className="mb-3 flex gap-2">
                          <input
                            type="text"
                            value={newGoalInputs.get(yearKey) || ''}
                            onChange={(e) => setNewGoalInputs(prev => new Map(prev).set(yearKey, e.target.value))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addYearGoal(year)
                              }
                            }}
                            placeholder="Введите цель и нажмите Enter..."
                            className={`flex-1 px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 ${distance === 0 ? 'border-emerald-200 focus:ring-emerald-300 focus:border-emerald-400' : distance === 1 ? 'border-blue-200 focus:ring-blue-300 focus:border-blue-400' : distance <= 3 ? 'border-purple-200 focus:ring-purple-300 focus:border-purple-400' : 'border-amber-200 focus:ring-amber-300 focus:border-amber-400'}`}
                          />
                          <button
                            onClick={() => addYearGoal(year)}
                            className={`px-4 py-2 rounded-lg font-medium text-white transition-all hover:scale-105 ${distance === 0 ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600' : distance === 1 ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600' : distance <= 3 ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600' : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'}`}
                          >
                            + Добавить
                          </button>
                        </div>

                        {/* Список целей */}
                        <div className="space-y-2">
                          {yearGoalsList.length === 0 ? (
                            <div className={`text-center py-6 rounded-lg border-2 border-dashed ${distance === 0 ? 'border-emerald-200 bg-emerald-50/50' : distance === 1 ? 'border-blue-200 bg-blue-50/50' : distance <= 3 ? 'border-purple-200 bg-purple-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                              <span className="text-3xl block mb-2">🎯</span>
                              <p className="text-gray-500 text-sm">Добавьте цели на {year} год...</p>
                            </div>
                          ) : (
                            yearGoalsList.map((goal, index) => {
                              // Поиск где скопирована эта задача (кварталы, месяцы и недели)
                              const copiedTo: { type: 'quarter' | 'month' | 'week'; label: string; key: string }[] = []
                              const goalLower = goal.trim().toLowerCase()
                              
                              // Проверяем кварталы
                              ;[1, 2, 3, 4].forEach(q => {
                                const qKey = `${year}-Q${q}`
                                const qGoals = periodGoals.get(qKey) || []
                                if (qGoals.some(g => g.trim().toLowerCase() === goalLower)) {
                                  copiedTo.push({ type: 'quarter', label: `Q${q}`, key: qKey })
                                }
                              })
                              
                              // Проверяем месяцы (показываем всегда, даже если есть недели)
                              monthNames.forEach((mName, mIdx) => {
                                const mKey = `${year}-${String(mIdx + 1).padStart(2, '0')}`
                                const mGoals = periodGoals.get(mKey) || []
                                if (mGoals.some(g => g.trim().toLowerCase() === goalLower)) {
                                  copiedTo.push({ type: 'month', label: mName.slice(0, 3), key: mKey })
                                }
                              })
                              
                              // Проверяем недели (показываем отдельно от месяцев)
                              if (year === currentYear) {
                                for (let m = 0; m < 12; m++) {
                                  for (let w = 1; w <= 5; w++) {
                                    const wKey = `${year}-${String(m + 1).padStart(2, '0')}-W${w}`
                                    const wGoals = periodGoals.get(wKey) || []
                                    if (wGoals.some(g => g.trim().toLowerCase() === goalLower)) {
                                      copiedTo.push({ type: 'week', label: `W${w}`, key: wKey })
                                    }
                                  }
                                }
                              }
                              
                              return (
                              <div
                                key={index}
                                className={`flex items-center gap-3 p-3 rounded-lg border-l-4 bg-white shadow-sm hover:shadow transition-shadow ${distance === 0 ? 'border-l-emerald-400' : distance === 1 ? 'border-l-blue-400' : distance <= 3 ? 'border-l-purple-400' : 'border-l-amber-400'}`}
                              >
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${distance === 0 ? 'bg-emerald-500' : distance === 1 ? 'bg-blue-500' : distance <= 3 ? 'bg-purple-500' : 'bg-amber-500'}`}>
                                  {index + 1}
                                </span>
                                {editingGoal === `year-${year}-${index}` ? (
                                  <input
                                    type="text"
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    onBlur={() => saveEditYearGoal(year, index)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveEditYearGoal(year, index)
                                      if (e.key === 'Escape') { setEditingGoal(null); setEditingText('') }
                                    }}
                                    className="flex-1 px-2 py-1 border-2 border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    autoFocus
                                  />
                                ) : (
                                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                                    <span 
                                      className={`${copiedTo.length > 0 ? 'cursor-pointer hover:text-blue-600 underline decoration-dotted underline-offset-2' : ''} transition-colors`}
                                      onClick={() => {
                                        // Клик на задачу — переход к самому глубокому уровню + подмигивание
                                        if (copiedTo.length > 0) {
                                          // Ищем самый глубокий уровень
                                          const weekItem = copiedTo.find(c => c.type === 'week')
                                          const monthItem = copiedTo.find(c => c.type === 'month')
                                          const quarterItem = copiedTo.find(c => c.type === 'quarter')
                                          
                                          if (weekItem) {
                                            // Переход к неделе
                                            const parts = weekItem.key.split('-') // 2025-12-W1
                                            const mIdx = parseInt(parts[1]) - 1
                                            const qNum = Math.floor(mIdx / 3) + 1
                                            const qKey = `${year}-Q${qNum}`
                                            const mKey = `${year}-${parts[1]}`
                                            
                                            setExpandedPeriods(prev => new Set(prev).add(qKey))
                                            setCollapsedMonths(prev => {
                                              const next = new Set(prev)
                                              next.delete(mKey)
                                              return next
                                            })
                                            scrollToAndBlink(`week-${weekItem.key}`, 150)
                                          } else if (monthItem) {
                                            // Переход к месяцу
                                            const mIdx = parseInt(monthItem.key.split('-')[1]) - 1
                                            const qNum = Math.floor(mIdx / 3) + 1
                                            const qKey = `${year}-Q${qNum}`
                                            setExpandedPeriods(prev => new Set(prev).add(qKey))
                                            setCollapsedMonths(prev => {
                                              const next = new Set(prev)
                                              next.delete(monthItem.key)
                                              return next
                                            })
                                            scrollToAndBlink(`month-${monthItem.key}`, 150)
                                          } else if (quarterItem) {
                                            setExpandedPeriods(prev => new Set(prev).add(quarterItem.key))
                                            scrollToAndBlink(`quarter-${quarterItem.key}`, 100)
                                          }
                                        }
                                      }}
                                      title={copiedTo.length > 0 ? "Нажмите для перехода к конечной цели" : ""}
                                    >
                                      {goal}
                                    </span>
                                    {/* Бейджи — где скопирована задача (кликабельные) */}
                                    {copiedTo.length > 0 && (
                                      <div className="flex gap-1 flex-wrap">
                                        {copiedTo.map((c, i) => (
                                          <span 
                                            key={i}
                                            className={`text-xs px-2 py-1 rounded-md border cursor-pointer hover:opacity-80 transition-opacity font-medium ${
                                              c.type === 'quarter' ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100' : 
                                              c.type === 'month' ? 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100' : 
                                              'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                                            }`}
                                            onClick={() => {
                                              // Скролл к кварталу, месяцу или неделе
                                              if (c.type === 'quarter') {
                                                setExpandedPeriods(prev => new Set(prev).add(c.key))
                                                setTimeout(() => {
                                                  const el = document.getElementById(`quarter-${c.key}`)
                                                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                                }, 100)
                                              } else if (c.type === 'month') {
                                                const mIdx = parseInt(c.key.split('-')[1]) - 1
                                                const qNum = Math.floor(mIdx / 3) + 1
                                                const qKey = `${year}-Q${qNum}`
                                                setExpandedPeriods(prev => new Set(prev).add(qKey))
                                                setCollapsedMonths(prev => {
                                                  const next = new Set(prev)
                                                  next.delete(c.key)
                                                  return next
                                                })
                                                setTimeout(() => {
                                                  const el = document.getElementById(`month-${c.key}`)
                                                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                                }, 100)
                                              } else {
                                                // week
                                                const parts = c.key.split('-') // 2025-12-W1
                                                const mIdx = parseInt(parts[1]) - 1
                                                const qNum = Math.floor(mIdx / 3) + 1
                                                const qKey = `${year}-Q${qNum}`
                                                const mKey = `${year}-${parts[1]}`
                                                
                                                setExpandedPeriods(prev => new Set(prev).add(qKey))
                                                setCollapsedMonths(prev => {
                                                  const next = new Set(prev)
                                                  next.delete(mKey)
                                                  return next
                                                })
                                                setTimeout(() => {
                                                  const el = document.getElementById(`week-${c.key}`)
                                                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                                }, 150)
                                              }
                                            }}
                                            title="Нажмите для перехода"
                                          >
                                            {c.label}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* Кнопка копирования в квартал/месяц */}
                                {(detailLevel === 'month' || detailLevel === 'quarter') && (
                                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => setCopyDropdown(copyDropdown === `year-${year}-${index}` ? null : `year-${year}-${index}`)}
                                      className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded p-1 transition-colors"
                                      title="Копировать в период"
                                    >
                                      ↓
                                    </button>
                                    {copyDropdown === `year-${year}-${index}` && (
                                      <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[160px] max-h-[400px] overflow-y-auto">
                                        <div className="px-3 py-1 text-xs text-gray-500 font-medium border-b border-gray-100">Кварталы</div>
                                        {[1, 2, 3, 4].map(q => (
                                          <button
                                            key={q}
                                            onClick={() => copyYearGoalToQuarter(year, goal, q)}
                                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 transition-colors"
                                          >
                                            → Q{q}
                                          </button>
                                        ))}
                                        <div className="px-3 py-1 text-xs text-gray-500 font-medium border-b border-t border-gray-100 mt-1">Месяцы</div>
                                        {monthNames.map((mName, mIdx) => (
                                          <button
                                            key={mIdx}
                                            onClick={() => copyYearGoalToMonth(year, goal, mIdx)}
                                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 transition-colors"
                                          >
                                            → {mName}
                                          </button>
                                        ))}
                                        {/* Недели текущего месяца */}
                                        {year === currentYear && (() => {
                                          const today = new Date()
                                          const currMonth = today.getMonth()
                                          const weeksData: { num: number; start: Date; end: Date }[] = []
                                          const firstD = new Date(year, currMonth, 1)
                                          const lastD = new Date(year, currMonth + 1, 0)
                                          let curr = new Date(firstD)
                                          while (curr.getDay() !== 1) curr.setDate(curr.getDate() + 1)
                                          let wNum = 1
                                          while (curr <= lastD) {
                                            const wStart = new Date(curr)
                                            const wEnd = new Date(curr)
                                            wEnd.setDate(wEnd.getDate() + 6)
                                            weeksData.push({ num: wNum, start: wStart, end: wEnd })
                                            curr.setDate(curr.getDate() + 7)
                                            wNum++
                                          }
                                          
                                          return (
                                            <>
                                              <div className="px-3 py-1 text-xs text-gray-500 font-medium border-b border-t border-gray-100 mt-1">
                                                Недели {monthNames[currMonth]}
                                              </div>
                                              {weeksData.map(w => (
                                                <button
                                                  key={w.num}
                                                  onClick={() => copyYearGoalToWeek(year, goal, currMonth, w.num, w.start)}
                                                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-amber-50 transition-colors"
                                                >
                                                  → W{w.num} ({w.start.getDate()}-{w.end.getDate()})
                                                </button>
                                              ))}
                                            </>
                                          )
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                )}
                                <button
                                  onClick={() => startEditYearGoal(year, index, goal)}
                                  className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded p-1 transition-colors"
                                  title="Редактировать"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => removeYearGoal(year, index)}
                                  className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full p-1 transition-colors"
                                  title="Удалить цель"
                                >
                                  ✕
                                </button>
                              </div>
                              )
                            })
                          )}
                        </div>
                      </div>

                      {/* Детализация по периодам */}
                      {detailLevel !== 'year' && (
                        <div className="border-t border-gray-100 pt-4 space-y-3">
                          <h4 className="font-semibold text-gray-600 text-sm flex items-center gap-2">
                            <span>📋</span>
                            Детализация по периодам:
                          </h4>

                          {/* Кварталы для текущего и следующего года */}
                          {(detailLevel === 'month' || detailLevel === 'quarter') && (
                            <div className="space-y-2">
                              {[1, 2, 3, 4].map(quarter => {
                                const quarterKey = `${year}-Q${quarter}`
                                const quarterGoals = periodGoals.get(quarterKey) || []
                                const isQuarterExpanded = expandedPeriods.has(quarterKey)
                                const quarterDate = new Date(year, (quarter - 1) * 3, 1)
                                const isCurrentQuarter = year === currentYear && quarter === Math.floor(new Date().getMonth() / 3) + 1

                                const quarterColors = ['from-rose-400 to-pink-500', 'from-amber-400 to-orange-500', 'from-emerald-400 to-teal-500', 'from-blue-400 to-indigo-500']
                                const quarterBgColors = ['bg-rose-50 border-rose-200', 'bg-amber-50 border-amber-200', 'bg-emerald-50 border-emerald-200', 'bg-blue-50 border-indigo-200']
                                const quarterTextColors = ['text-rose-600', 'text-amber-600', 'text-emerald-600', 'text-blue-600']

                                return (
                                  <div key={quarterKey} id={`quarter-${quarterKey}`} className={`rounded-lg border-2 overflow-hidden ${quarterBgColors[quarter - 1]}`}>
                                    <button
                                      onClick={() => {
                                        const newExpanded = new Set(expandedPeriods)
                                        if (newExpanded.has(quarterKey)) {
                                          newExpanded.delete(quarterKey)
                                        } else {
                                          newExpanded.add(quarterKey)
                                          loadPeriodGoalsWithKey('quarter', quarterDate)
                                        }
                                        setExpandedPeriods(newExpanded)
                                      }}
                                      className={`w-full px-3 py-2 flex items-center justify-between hover:bg-white/50 transition-colors`}
                                    >
                                      <div className="flex items-center gap-2 flex-1">
                                        <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${quarterColors[quarter - 1]} flex items-center justify-center text-white text-sm shadow-sm`}>
                                          {isQuarterExpanded ? '▼' : '▶'}
                                        </span>
                                        <span className="font-semibold">
                                          📊 Q{quarter}
                                          {isCurrentQuarter && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">сейчас</span>}
                                        </span>
                                        <span className={`text-sm ${quarterTextColors[quarter - 1]}`}>
                                          {quarterGoals.length} {quarterGoals.length === 1 ? 'цель' : quarterGoals.length < 5 ? 'цели' : 'целей'}
                                        </span>
                                        {/* Прогресс-бар квартала */}
                                        {quarterGoals.length > 0 && (() => {
                                          const progress = calculatePeriodProgress(quarterKey)
                                          return (
                                            <div className="flex items-center gap-2 ml-auto">
                                              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                  className={`h-full rounded-full transition-all bg-gradient-to-r ${quarterColors[quarter - 1]}`}
                                                  style={{ width: `${progress.percent}%` }}
                                                />
                                              </div>
                                              <span className="text-xs text-gray-500 font-medium">{progress.completed}/{progress.total}</span>
                                            </div>
                                          )
                                        })()}
                                      </div>
                                    </button>

                                    {isQuarterExpanded && (
                                      <div className="px-3 pb-3 space-y-3 bg-white/70">
                                        {/* Поле добавления новой цели для квартала */}
                                        <div className="flex gap-2 pt-2">
                                          <input
                                            type="text"
                                            value={newGoalInputs.get(quarterKey) || ''}
                                            onChange={(e) => setNewGoalInputs(prev => new Map(prev).set(quarterKey, e.target.value))}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault()
                                                addPeriodGoal(quarterKey, 'quarter', quarterDate, `Q${quarter} ${year}`)
                                              }
                                            }}
                                            placeholder={`Цель на Q${quarter}...`}
                                            className="flex-1 px-3 py-1.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
                                          />
                                          <button
                                            onClick={() => addPeriodGoal(quarterKey, 'quarter', quarterDate, `Q${quarter} ${year}`)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r ${quarterColors[quarter - 1]} hover:opacity-90 transition-opacity`}
                                          >
                                            +
                                          </button>
                                        </div>

                                        {/* Список целей квартала */}
                                        <div className="space-y-1">
                                          {quarterGoals.length === 0 ? (
                                            <p className="text-gray-400 text-xs text-center py-2">
                                              Нет целей на Q{quarter}
                                            </p>
                                          ) : (
                                            quarterGoals.map((goal, index) => {
                                              // Поиск где скопирована эта задача (месяцы и недели)
                                              const copiedTo: { type: 'month' | 'week'; label: string; key: string }[] = []
                                              const goalLower = goal.trim().toLowerCase()
                                              
                                              // Проверяем месяцы квартала
                                              ;[0, 1, 2].forEach(offset => {
                                                const m = (quarter - 1) * 3 + offset
                                                const mKey = `${year}-${String(m + 1).padStart(2, '0')}`
                                                const mGoals = periodGoals.get(mKey) || []
                                                if (mGoals.some(g => g.trim().toLowerCase() === goalLower)) {
                                                  copiedTo.push({ type: 'month', label: monthNames[m].slice(0, 3), key: mKey })
                                                }
                                              })
                                              
                                              // Проверяем недели текущего месяца (если квартал текущий)
                                              const currMonth = new Date().getMonth()
                                              const currQuarter = Math.floor(currMonth / 3) + 1
                                              if (quarter === currQuarter && year === currentYear) {
                                                const firstD = new Date(year, currMonth, 1)
                                                const lastD = new Date(year, currMonth + 1, 0)
                                                let curr = new Date(firstD)
                                                while (curr.getDay() !== 1) curr.setDate(curr.getDate() + 1)
                                                let wNum = 1
                                                while (curr <= lastD) {
                                                  const wKey = `${year}-${String(currMonth + 1).padStart(2, '0')}-W${wNum}`
                                                  const wGoals = periodGoals.get(wKey) || []
                                                  if (wGoals.some(g => g.trim().toLowerCase() === goalLower)) {
                                                    copiedTo.push({ type: 'week', label: `W${wNum}`, key: wKey })
                                                  }
                                                  curr.setDate(curr.getDate() + 7)
                                                  wNum++
                                                }
                                              }
                                              
                                              return (
                                              <div
                                                key={index}
                                                className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-100 shadow-sm"
                                              >
                                                <span className={`w-5 h-5 rounded-full bg-gradient-to-br ${quarterColors[quarter - 1]} flex items-center justify-center text-white text-xs`}>
                                                  {index + 1}
                                                </span>
                                                {editingGoal === `period-${quarterKey}-${index}` ? (
                                                  <input
                                                    type="text"
                                                    value={editingText}
                                                    onChange={(e) => setEditingText(e.target.value)}
                                                    onBlur={() => saveEditPeriodGoal(quarterKey, index, 'quarter', quarterDate, `Q${quarter} ${year}`)}
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter') saveEditPeriodGoal(quarterKey, index, 'quarter', quarterDate, `Q${quarter} ${year}`)
                                                      if (e.key === 'Escape') { setEditingGoal(null); setEditingText('') }
                                                    }}
                                                    className="flex-1 px-2 py-0.5 text-sm border-2 border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                    autoFocus
                                                  />
                                                ) : (
                                                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                                                    <span 
                                                      className={`text-sm ${copiedTo.length > 0 ? 'cursor-pointer hover:text-blue-600 underline decoration-dotted underline-offset-2' : ''} transition-colors`}
                                                      onClick={() => {
                                                        // Клик — переход к самому глубокому уровню (неделя > месяц)
                                                        if (copiedTo.length > 0) {
                                                          const weekItem = copiedTo.find(c => c.type === 'week')
                                                          const monthItem = copiedTo.find(c => c.type === 'month')
                                                          
                                                          if (weekItem) {
                                                            // Переход к неделе с подмигиванием
                                                            const parts = weekItem.key.split('-') // 2025-12-W1
                                                            const mKey = `${parts[0]}-${parts[1]}`
                                                            setCollapsedMonths(prev => {
                                                              const next = new Set(prev)
                                                              next.delete(mKey)
                                                              return next
                                                            })
                                                            scrollToAndBlink(`week-${weekItem.key}`, 150)
                                                          } else if (monthItem) {
                                                            setCollapsedMonths(prev => {
                                                              const next = new Set(prev)
                                                              next.delete(monthItem.key)
                                                              return next
                                                            })
                                                            scrollToAndBlink(`month-${monthItem.key}`, 150)
                                                          }
                                                        }
                                                      }}
                                                      title={copiedTo.length > 0 ? "Нажмите для перехода к конечной цели" : ""}
                                                    >
                                                      {goal}
                                                    </span>
                                                    {/* Бейджи — где скопирована задача (кликабельные) */}
                                                    {copiedTo.length > 0 && (
                                                      <div className="flex gap-1 flex-wrap">
                                                        {copiedTo.map((c, i) => {
                                                          // Используем key из copiedTo
                                                          const targetId = c.type === 'month' ? `month-${c.key}` : `week-${c.key}`
                                                          
                                                          return (
                                                          <span 
                                                            key={i}
                                                            className={`text-xs px-2 py-1 rounded-md border cursor-pointer hover:opacity-80 transition-opacity font-medium ${c.type === 'month' ? 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100' : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'}`}
                                                            onClick={() => {
                                                              // Разворачиваем месяц если нужно (для недель)
                                                              if (c.type === 'week') {
                                                                const parts = c.key.split('-')
                                                                const mKey = `${parts[0]}-${parts[1]}`
                                                                setCollapsedMonths(prev => {
                                                                  const next = new Set(prev)
                                                                  next.delete(mKey)
                                                                  return next
                                                                })
                                                              } else if (c.type === 'month') {
                                                                setCollapsedMonths(prev => {
                                                                  const next = new Set(prev)
                                                                  next.delete(c.key)
                                                                  return next
                                                                })
                                                              }
                                                              scrollToAndBlink(targetId, 150)
                                                            }}
                                                            title="Нажмите для перехода"
                                                          >
                                                            {c.label}
                                                          </span>
                                                          )
                                                        })}
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                                {/* Кнопка копирования в месяц/неделю */}
                                                {detailLevel === 'month' && (
                                                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                      onClick={() => setCopyDropdown(copyDropdown === `quarter-${quarterKey}-${index}` ? null : `quarter-${quarterKey}-${index}`)}
                                                      className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded p-1 transition-colors"
                                                      title="Копировать в период"
                                                    >
                                                      ↓
                                                    </button>
                                                    {copyDropdown === `quarter-${quarterKey}-${index}` && (
                                                      <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[140px] max-h-[300px] overflow-y-auto">
                                                        <div className="px-3 py-1 text-xs text-gray-500 font-medium border-b border-gray-100">Месяцы Q{quarter}</div>
                                                        {[0, 1, 2].map(offset => {
                                                          const m = (quarter - 1) * 3 + offset
                                                          return (
                                                            <button
                                                              key={m}
                                                              onClick={() => copyQuarterGoalToMonth(year, quarter, goal, m)}
                                                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 transition-colors"
                                                            >
                                                              → {monthNames[m]}
                                                            </button>
                                                          )
                                                        })}
                                                        {/* Недели текущего месяца */}
                                                        {(() => {
                                                          const today = new Date()
                                                          const currMonth = today.getMonth()
                                                          const currQuarter = Math.floor(currMonth / 3) + 1
                                                          // Показываем недели только если текущий квартал
                                                          if (quarter !== currQuarter || year !== currentYear) return null
                                                          
                                                          const weeksData: { num: number; start: Date; end: Date }[] = []
                                                          const firstD = new Date(year, currMonth, 1)
                                                          const lastD = new Date(year, currMonth + 1, 0)
                                                          let curr = new Date(firstD)
                                                          while (curr.getDay() !== 1) curr.setDate(curr.getDate() + 1)
                                                          let wNum = 1
                                                          while (curr <= lastD) {
                                                            const wEnd = new Date(curr)
                                                            wEnd.setDate(wEnd.getDate() + 6)
                                                            weeksData.push({ num: wNum, start: new Date(curr), end: wEnd })
                                                            curr.setDate(curr.getDate() + 7)
                                                            wNum++
                                                          }
                                                          
                                                          return (
                                                            <>
                                                              <div className="px-3 py-1 text-xs text-gray-500 font-medium border-b border-t border-gray-100 mt-1">Недели {monthNames[currMonth]}</div>
                                                              {weeksData.map(w => (
                                                                <button
                                                                  key={w.num}
                                                                  onClick={() => copyQuarterGoalToWeek(year, goal, currMonth, w.num, w.start)}
                                                                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 transition-colors"
                                                                >
                                                                  → W{w.num} ({w.start.getDate()}-{w.end.getDate()})
                                                                </button>
                                                              ))}
                                                            </>
                                                          )
                                                        })()}
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                                <button
                                                  onClick={() => startEditPeriodGoal(quarterKey, index, goal)}
                                                  className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded p-1 transition-colors text-xs"
                                                  title="Редактировать"
                                                >
                                                  ✏️
                                                </button>
                                                <button
                                                  onClick={() => removePeriodGoal(quarterKey, index, 'quarter', quarterDate, `Q${quarter} ${year}`)}
                                                  className="text-red-400 hover:text-red-600 text-xs p-1 hover:bg-red-50 rounded transition-colors"
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                              )
                                            })
                                          )}
                                        </div>

                                        {/* Месяцы внутри квартала для текущего года */}
                                        {detailLevel === 'month' && (
                                          <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
                                            <div className="flex items-center justify-between mb-2">
                                              <p className="text-base text-gray-500 font-medium">📅 Детализация по месяцам:</p>
                                              <button
                                                onClick={() => setShowAllPeriods(!showAllPeriods)}
                                                className="text-base text-blue-500 hover:text-blue-700 transition-colors px-3 py-1.5 rounded hover:bg-blue-50"
                                              >
                                                {showAllPeriods ? '🙈 Скрыть пустые' : '👁 Показать все'}
                                              </button>
                                            </div>
                                            {[0, 1, 2].map(monthOffset => {
                                              const month = (quarter - 1) * 3 + monthOffset
                                              const monthDate = new Date(year, month, 1)
                                              const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
                                              const monthGoals = periodGoals.get(monthKey) || []
                                              const isCurrentMonth = year === currentYear && month === new Date().getMonth()

                                              // Скрываем пустые месяцы, если не включён showAllPeriods (кроме текущего)
                                              if (monthGoals.length === 0 && !showAllPeriods && !isCurrentMonth) {
                                                return null
                                              }

                                              const monthColors = ['bg-gradient-to-r from-sky-400 to-blue-500', 'bg-gradient-to-r from-violet-400 to-purple-500', 'bg-gradient-to-r from-pink-400 to-rose-500']
                                              const monthGradients = ['from-sky-400 to-blue-500', 'from-violet-400 to-purple-500', 'from-pink-400 to-rose-500']
                                              const isMonthCollapsed = collapsedMonths.has(monthKey)
                                              const monthProgress = calculatePeriodProgress(monthKey)

                                              return (
                                                <div key={monthKey} id={`month-${monthKey}`} className={`rounded-lg p-3 ${isCurrentMonth ? 'bg-gradient-to-r from-sky-50 to-blue-50 border-2 border-sky-200' : 'bg-gray-50 border border-gray-100'}`}>
                                                  <div 
                                                    className="flex items-center gap-2 mb-2 cursor-pointer"
                                                    onClick={() => setCollapsedMonths(prev => {
                                                      const next = new Set(prev)
                                                      if (next.has(monthKey)) next.delete(monthKey)
                                                      else next.add(monthKey)
                                                      return next
                                                    })}
                                                  >
                                                    <span className={`w-7 h-7 rounded-lg ${monthColors[monthOffset]} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
                                                      {isMonthCollapsed ? '▶' : '▼'}
                                                    </span>
                                                    <span className="font-medium text-sm">
                                                      {monthNames[month]}
                                                      {isCurrentMonth && <span className="ml-2 text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">сейчас</span>}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                      ({monthGoals.length} {monthGoals.length === 1 ? 'цель' : monthGoals.length < 5 ? 'цели' : 'целей'})
                                                    </span>
                                                    {/* Прогресс-бар месяца */}
                                                    {monthProgress.total > 0 && (
                                                      <div className="flex items-center gap-2 ml-auto">
                                                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                          <div 
                                                            className={`h-full rounded-full transition-all bg-gradient-to-r ${monthGradients[monthOffset]}`}
                                                            style={{ width: `${monthProgress.percent}%` }}
                                                          />
                                                        </div>
                                                        <span className="text-xs text-gray-500">{monthProgress.percent}%</span>
                                                      </div>
                                                    )}
                                                  </div>

                                                  {/* Контент месяца (скрывается при свернутом состоянии) */}
                                                  {!isMonthCollapsed && (
                                                    <>
                                                  {/* Поле добавления цели для месяца */}
                                                  <div className="flex gap-2 mb-2">
                                                    <input
                                                      type="text"
                                                      value={newGoalInputs.get(monthKey) || ''}
                                                      onChange={(e) => setNewGoalInputs(prev => new Map(prev).set(monthKey, e.target.value))}
                                                      onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                          e.preventDefault()
                                                          addPeriodGoal(monthKey, 'month', monthDate, monthNames[month])
                                                        }
                                                      }}
                                                      placeholder="Добавить цель..."
                                                      className="flex-1 px-3 py-1.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300"
                                                      onClick={(e) => e.stopPropagation()}
                                                    />
                                                    <button
                                                      onClick={(e) => { e.stopPropagation(); addPeriodGoal(monthKey, 'month', monthDate, monthNames[month]) }}
                                                      className={`${monthColors[monthOffset]} text-white text-sm px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity`}
                                                    >
                                                      +
                                                    </button>
                                                  </div>

                                                  {/* Список целей месяца */}
                                                  <div className="space-y-1">
                                                    {monthGoals.length === 0 ? (
                                                      <p className="text-gray-400 text-sm text-center py-2">
                                                        Нет целей
                                                      </p>
                                                    ) : (
                                                      (() => {
                                                        // Вычисляем недели месяца
                                                        const weeksInMonth: { num: number; key: string }[] = []
                                                        const firstD = new Date(year, month, 1)
                                                        const lastD = new Date(year, month + 1, 0)
                                                        let curr = new Date(firstD)
                                                        while (curr.getDay() !== 1) curr.setDate(curr.getDate() + 1)
                                                        let wNum = 1
                                                        while (curr <= lastD) {
                                                          weeksInMonth.push({ num: wNum, key: `${year}-${String(month + 1).padStart(2, '0')}-W${wNum}` })
                                                          curr.setDate(curr.getDate() + 7)
                                                          wNum++
                                                        }
                                                        
                                                        // Для каждой задачи определяем в каких неделях она есть
                                                        const goalsWithWeeks = monthGoals.map((goal, origIndex) => {
                                                          const goalLower = goal.trim().toLowerCase()
                                                          const inWeeks: number[] = []
                                                          weeksInMonth.forEach(w => {
                                                            const wGoals = periodGoals.get(w.key) || []
                                                            if (wGoals.some(g => g.trim().toLowerCase() === goalLower)) {
                                                              inWeeks.push(w.num)
                                                            }
                                                          })
                                                          return { goal, origIndex, inWeeks, minWeek: inWeeks.length > 0 ? Math.min(...inWeeks) : 999 }
                                                        })
                                                        
                                                        // Сортируем: сначала не разнесённые (minWeek=999), потом по неделям
                                                        const sorted = [...goalsWithWeeks].sort((a, b) => {
                                                          if (a.minWeek === 999 && b.minWeek !== 999) return -1
                                                          if (a.minWeek !== 999 && b.minWeek === 999) return 1
                                                          return a.minWeek - b.minWeek
                                                        })
                                                        
                                                        return sorted.map(({ goal, origIndex, inWeeks }, displayIndex) => (
                                                        <div
                                                          key={origIndex}
                                                          className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-100 shadow-sm"
                                                        >
                                                          <span className={`w-5 h-5 rounded-full ${monthColors[monthOffset]} flex items-center justify-center text-white text-xs`}>
                                                            {displayIndex + 1}
                                                          </span>
                                                          {editingGoal === `period-${monthKey}-${origIndex}` ? (
                                                            <input
                                                              type="text"
                                                              value={editingText}
                                                              onChange={(e) => setEditingText(e.target.value)}
                                                              onBlur={() => saveEditPeriodGoal(monthKey, origIndex, 'month', monthDate, monthNames[month])}
                                                              onKeyDown={(e) => {
                                                                if (e.key === 'Enter') saveEditPeriodGoal(monthKey, origIndex, 'month', monthDate, monthNames[month])
                                                                if (e.key === 'Escape') { setEditingGoal(null); setEditingText('') }
                                                              }}
                                                              className="flex-1 px-2 py-0.5 text-sm border-2 border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                              autoFocus
                                                            />
                                                          ) : (
                                                            <div className="flex-1 flex items-center gap-2 flex-wrap">
                                                              <span 
                                                                className={`text-sm ${inWeeks.length > 0 ? 'cursor-pointer hover:text-blue-600 underline decoration-dotted underline-offset-2' : ''} transition-colors`}
                                                                onClick={() => {
                                                                  // Клик — переход с подмигиванием (если есть бейджи)
                                                                  if (inWeeks.length > 0) {
                                                                    const firstWeek = Math.min(...inWeeks)
                                                                    const targetId = `week-${year}-${String(month + 1).padStart(2, '0')}-W${firstWeek}`
                                                                    scrollToAndBlink(targetId, 100)
                                                                  }
                                                                }}
                                                                title={inWeeks.length > 0 ? "Нажмите для перехода" : ""}
                                                              >
                                                                {goal}
                                                              </span>
                                                              {/* Бейджи недель (кликабельные) */}
                                                              {inWeeks.length > 0 && (
                                                                <div className="flex gap-1 flex-wrap">
                                                                  {inWeeks.map(wNum => (
                                                                    <span 
                                                                      key={wNum}
                                                                      className="text-xs px-2 py-1 rounded-md border bg-amber-50 text-amber-700 border-amber-300 cursor-pointer hover:bg-amber-100 transition-colors font-medium"
                                                                      onClick={() => {
                                                                        const targetId = `week-${year}-${String(month + 1).padStart(2, '0')}-W${wNum}`
                                                                        scrollToAndBlink(targetId, 100)
                                                                      }}
                                                                      title="Нажмите для перехода"
                                                                    >
                                                                      W{wNum}
                                                                    </span>
                                                                  ))}
                                                                </div>
                                                              )}
                                                            </div>
                                                          )}
                                                          {/* Кнопка копирования в неделю (только для текущего месяца) */}
                                                          {isCurrentMonth && (
                                                            <div className="relative" onClick={(e) => e.stopPropagation()}>
                                                              <button
                                                                onClick={() => setCopyDropdown(copyDropdown === `month-${monthKey}-${origIndex}` ? null : `month-${monthKey}-${origIndex}`)}
                                                                className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded p-1 transition-colors"
                                                                title="Копировать в неделю"
                                                              >
                                                                ↓
                                                              </button>
                                                              {copyDropdown === `month-${monthKey}-${origIndex}` && (
                                                                <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[100px]">
                                                                  {weeksInMonth.map(w => (
                                                                      <button
                                                                        key={w.num}
                                                                        onClick={() => {
                                                                          const firstD = new Date(year, month, 1)
                                                                          let curr = new Date(firstD)
                                                                          while (curr.getDay() !== 1) curr.setDate(curr.getDate() + 1)
                                                                          for (let i = 1; i < w.num; i++) curr.setDate(curr.getDate() + 7)
                                                                          copyMonthGoalToWeek(year, month, goal, w.num, curr)
                                                                        }}
                                                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors"
                                                                      >
                                                                        → Неделя {w.num}
                                                                      </button>
                                                                    ))}
                                                                </div>
                                                              )}
                                                            </div>
                                                          )}
                                                          <button
                                                            onClick={() => startEditPeriodGoal(monthKey, origIndex, goal)}
                                                            className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded p-1 transition-colors text-xs"
                                                            title="Редактировать"
                                                          >
                                                            ✏️
                                                          </button>
                                                          <button
                                                            onClick={() => removePeriodGoal(monthKey, origIndex, 'month', monthDate, monthNames[month])}
                                                            className="text-red-400 hover:text-red-600 text-xs px-1"
                                                          >
                                                            ✕
                                                          </button>
                                                        </div>
                                                        ))
                                                      })()
                                                    )}
                                                  </div>

                                                  {/* Недели для текущего месяца */}
                                                  {month === new Date().getMonth() && year === currentYear && (
                                                    <div className="border-t border-gray-100 mt-3 pt-3">
                                                      <p className="text-xs text-gray-500 font-medium mb-2">✨ Недели месяца:</p>
                                                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                                      {(() => {
                                                        const today = new Date()
                                                        const weeks: Date[] = []
                                                        const firstDay = new Date(year, month, 1)
                                                        const lastDay = new Date(year, month + 1, 0)

                                                        let current = new Date(firstDay)
                                                        while (current.getDay() !== 1) {
                                                          current.setDate(current.getDate() + 1)
                                                        }

                                                        while (current <= lastDay) {
                                                          weeks.push(new Date(current))
                                                          current.setDate(current.getDate() + 7)
                                                        }

                                                        return weeks.map((weekStart, idx) => {
                                                          const weekEnd = new Date(weekStart)
                                                          weekEnd.setDate(weekEnd.getDate() + 6)
                                                          const weekKey = `${year}-${String(month + 1).padStart(2, '0')}-W${idx + 1}`
                                                          const weekGoals = periodGoals.get(weekKey) || []
                                                          const isCurrentWeek = today >= weekStart && today <= weekEnd
                                                          const isDragOver = dragOverWeek === weekKey

                                                          // Скрываем пустые недели, если не включён showAllPeriods (кроме текущей и при перетаскивании)
                                                          if (weekGoals.length === 0 && !showAllPeriods && !isCurrentWeek && !draggedGoal) {
                                                            return null
                                                          }

                                                          return (
                                                            <div 
                                                              key={weekKey} 
                                                              id={`week-${weekKey}`} 
                                                              className={`rounded-lg p-3 flex flex-col transition-all ${
                                                                isDragOver 
                                                                  ? 'bg-blue-100 border-2 border-blue-400 border-dashed scale-105' 
                                                                  : isCurrentWeek 
                                                                    ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-amber-200' 
                                                                    : 'bg-white border border-gray-100'
                                                              }`}
                                                              onDragOver={(e) => {
                                                                e.preventDefault()
                                                                if (draggedGoal && draggedGoal.weekKey !== weekKey) {
                                                                  setDragOverWeek(weekKey)
                                                                }
                                                              }}
                                                              onDragLeave={() => setDragOverWeek(null)}
                                                              onDrop={(e) => {
                                                                e.preventDefault()
                                                                if (draggedGoal && draggedGoal.weekKey !== weekKey) {
                                                                  moveGoalBetweenWeeks(draggedGoal.weekKey, weekKey, draggedGoal.index, draggedGoal.goal)
                                                                }
                                                                setDraggedGoal(null)
                                                                setDragOverWeek(null)
                                                              }}
                                                            >
                                                              {(() => {
                                                                const weekProgress = calculatePeriodProgress(weekKey)
                                                                return (
                                                              <div className="flex items-center gap-2 mb-2">
                                                                <span className={`w-7 h-7 rounded-full ${isCurrentWeek ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-gray-400 to-gray-500'} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                                                                  W{idx + 1}
                                                                </span>
                                                                <div className="flex flex-col flex-1">
                                                                  <div className="flex items-center justify-between">
                                                                    <span className="text-sm font-medium">
                                                                      {weekStart.getDate()}-{weekEnd.getDate()}
                                                                    </span>
                                                                    {weekProgress.total > 0 && (
                                                                      <span className="text-xs text-gray-400">{weekProgress.completed}/{weekProgress.total}</span>
                                                                    )}
                                                                  </div>
                                                                  {isCurrentWeek && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full w-fit">сейчас</span>}
                                                                  {/* Прогресс-бар недели */}
                                                                  {weekProgress.total > 0 && (
                                                                    <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mt-1">
                                                                      <div 
                                                                        className={`h-full rounded-full transition-all ${isCurrentWeek ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-gray-400 to-gray-500'}`}
                                                                        style={{ width: `${weekProgress.percent}%` }}
                                                                      />
                                                                    </div>
                                                                  )}
                                                                </div>
                                                              </div>
                                                                )
                                                              })()}

                                                              {/* Поле добавления цели для недели */}
                                                              <div className="flex gap-1 mb-2">
                                                                <input
                                                                  type="text"
                                                                  value={newGoalInputs.get(weekKey) || ''}
                                                                  onChange={(e) => setNewGoalInputs(prev => new Map(prev).set(weekKey, e.target.value))}
                                                                  onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                      e.preventDefault()
                                                                      addPeriodGoal(weekKey, 'week', weekStart, `Неделя ${idx + 1}`)
                                                                    }
                                                                  }}
                                                                  placeholder="Цель..."
                                                                  className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                                                                />
                                                                <button
                                                                  onClick={() => addPeriodGoal(weekKey, 'week', weekStart, `Неделя ${idx + 1}`)}
                                                                  className={`${isCurrentWeek ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-gray-400 to-gray-500'} text-white text-xs px-2 py-1 rounded-lg hover:opacity-90 transition-opacity`}
                                                                >
                                                                  +
                                                                </button>
                                                              </div>

                                                              {/* Список целей недели */}
                                                              <div className="space-y-1 flex-1 min-h-[40px]">
                                                                {weekGoals.length === 0 ? (
                                                                  <p className={`text-gray-400 text-xs text-center py-2 ${isDragOver ? 'text-blue-500' : ''}`}>
                                                                    {isDragOver ? '⬇️ Отпустите здесь' : '—'}
                                                                  </p>
                                                                ) : (
                                                                  weekGoals.map((goal, index) => {
                                                                    const goalKey = `week-${weekKey}-${index}`
                                                                    const lockKey = `${weekKey}-${goal}`
                                                                    const isProcessing = processingGoals.has(lockKey)
                                                                    const isExpanded = expandedGoals.has(goalKey)
                                                                    const isLongText = goal.length > 50
                                                                    const isDragging = draggedGoal?.weekKey === weekKey && draggedGoal?.index === index
                                                                    // Находим соответствующую цель с трекингом (точное совпадение или по началу текста)
                                                                    const trackedGoal = goals.find(g => 
                                                                      g.periodKey === weekKey && 
                                                                      (g.text === goal || g.text.startsWith(goal.slice(0, 30)) || goal.startsWith(g.text.slice(0, 30)))
                                                                    )
                                                                    
                                                                    const isCompleted = trackedGoal?.completed || false
                                                                    const goalDeadline = trackedGoal?.deadline
                                                                    const isDeadlineOverdue = goalDeadline && isOverdue(goalDeadline) && !isCompleted
                                                                    const goalPriority = trackedGoal?.priority || 0
                                                                    
                                                                    return (
                                                                    <div
                                                                      key={index}
                                                                      draggable
                                                                      onDragStart={() => setDraggedGoal({ weekKey, index, goal })}
                                                                      onDragEnd={() => {
                                                                        setDraggedGoal(null)
                                                                        setDragOverWeek(null)
                                                                      }}
                                                                      className={`p-1.5 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing transition-all ${
                                                                        isDragging ? 'opacity-50 scale-95' : 'hover:shadow-md'
                                                                      } ${isCompleted ? 'bg-green-50/80 border-green-200' : isDeadlineOverdue ? 'bg-red-50/80 border-red-300' : 'bg-white/80 border-gray-100 hover:border-gray-200'}`}
                                                                    >
                                                                      {editingGoal === `period-${weekKey}-${index}` ? (
                                                                        <textarea
                                                                          value={editingText}
                                                                          onChange={(e) => setEditingText(e.target.value)}
                                                                          onBlur={() => saveEditPeriodGoal(weekKey, index, 'week', weekStart, `Неделя ${idx + 1}`)}
                                                                          onKeyDown={(e) => {
                                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                              e.preventDefault()
                                                                              saveEditPeriodGoal(weekKey, index, 'week', weekStart, `Неделя ${idx + 1}`)
                                                                            }
                                                                            if (e.key === 'Escape') { setEditingGoal(null); setEditingText('') }
                                                                          }}
                                                                          className="w-full px-2 py-1 text-xs border-2 border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                                                                          rows={3}
                                                                          autoFocus
                                                                        />
                                                                      ) : (
                                                                        <div className="flex items-start gap-1.5">
                                                                          {/* Чекбокс выполнения */}
                                                                          <input
                                                                            type="checkbox"
                                                                            checked={isCompleted}
                                                                            disabled={isProcessing}
                                                                            onChange={async (e) => {
                                                                              e.stopPropagation()
                                                                              if (isProcessing) return
                                                                              await setGoalCompleted(weekKey, goal, !isCompleted)
                                                                            }}
                                                                            className={`w-4 h-4 mt-0.5 rounded border-gray-300 text-green-500 focus:ring-green-400 flex-shrink-0 ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                                                                          />
                                                                          <div className="flex-1 min-w-0">
                                                                            <div 
                                                                              className={`text-xs ${isLongText ? 'cursor-pointer' : ''} ${isLongText && !isExpanded ? 'line-clamp-3' : ''} ${isCompleted ? 'line-through text-gray-400' : ''}`}
                                                                              onClick={() => {
                                                                                if (isLongText) {
                                                                                  setExpandedGoals(prev => {
                                                                                    const next = new Set(prev)
                                                                                    if (next.has(goalKey)) next.delete(goalKey)
                                                                                    else next.add(goalKey)
                                                                                    return next
                                                                                  })
                                                                                }
                                                                              }}
                                                                              title={isLongText ? (isExpanded ? "Свернуть" : "Развернуть") : ""}
                                                                            >
                                                                              {goal}
                                                                              {isLongText && !isExpanded && <span className="text-blue-500 ml-1">...</span>}
                                                                            </div>
                                                                            {/* Дедлайн */}
                                                                            {goalDeadline && (
                                                                              <div className={`text-xs mt-0.5 ${isDeadlineOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                                                                                ⏰ {new Date(goalDeadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                                                                              </div>
                                                                            )}
                                                                          </div>
                                                                        </div>
                                                                      )}
                                                                      <div className="flex justify-end gap-1 mt-1">
                                                                        {/* Селектор приоритета */}
                                                                        <select
                                                                          value={goalPriority}
                                                                          disabled={isProcessing}
                                                                          onChange={async (e) => {
                                                                            e.stopPropagation()
                                                                            if (isProcessing) return
                                                                            const newPriority = parseInt(e.target.value)
                                                                            await setGoalPriority(weekKey, goal, newPriority)
                                                                          }}
                                                                          className={`text-xs px-1 py-0.5 border border-gray-200 rounded bg-white hover:bg-gray-50 ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                                                                          title="Приоритет"
                                                                        >
                                                                          <option value="0">⚪</option>
                                                                          <option value="1">🟡</option>
                                                                          <option value="2">🔴</option>
                                                                        </select>
                                                                        <button
                                                                          onClick={() => startEditPeriodGoal(weekKey, index, goal)}
                                                                          className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded p-0.5 transition-colors text-xs"
                                                                          title="Редактировать"
                                                                        >
                                                                          ✏️
                                                                        </button>
                                                                        <button
                                                                          onClick={() => removePeriodGoal(weekKey, index, 'week', weekStart, `Неделя ${idx + 1}`)}
                                                                          className="text-red-400 hover:text-red-600 text-xs px-1 hover:bg-red-50 rounded transition-colors"
                                                                        >
                                                                          ✕
                                                                        </button>
                                                                      </div>
                                                                    </div>
                                                                  )})
                                                                )}
                                                              </div>
                                                            </div>
                                                          )
                                                        })
                                                      })()}
                                                      </div>
                                                    </div>
                                                  )}
                                                    </>
                                                  )}
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Полугодия для дальних лет */}
                          {detailLevel === 'half' && (
                            <div className="space-y-2">
                              {[1, 2].map(half => {
                                const halfKey = `${year}-H${half}`
                                const halfGoals = periodGoals.get(halfKey) || []
                                const halfDate = new Date(year, (half - 1) * 6, 1)

                                const halfColors = half === 1 
                                  ? 'from-cyan-400 to-teal-500' 
                                  : 'from-indigo-400 to-purple-500'
                                const halfBgColors = half === 1 
                                  ? 'bg-gradient-to-r from-cyan-50 to-teal-50 border-cyan-200' 
                                  : 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200'

                                return (
                                  <div key={halfKey} className={`rounded-lg border-2 p-3 ${halfBgColors}`}>
                                    <div className="flex items-center gap-2 mb-3">
                                      <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${halfColors} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
                                        H{half}
                                      </span>
                                      <span className="font-semibold">
                                        {half === 1 ? 'Первое полугодие' : 'Второе полугодие'}
                                      </span>
                                      <span className={`text-sm ${half === 1 ? 'text-cyan-600' : 'text-indigo-600'}`}>
                                        ({halfGoals.length} {halfGoals.length === 1 ? 'цель' : halfGoals.length < 5 ? 'цели' : 'целей'})
                                      </span>
                                    </div>

                                    {/* Поле добавления цели для полугодия */}
                                    <div className="flex gap-2 mb-2">
                                      <input
                                        type="text"
                                        value={newGoalInputs.get(halfKey) || ''}
                                        onChange={(e) => setNewGoalInputs(prev => new Map(prev).set(halfKey, e.target.value))}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault()
                                            addPeriodGoal(halfKey, 'half_year', halfDate, `H${half} ${year}`)
                                          }
                                        }}
                                        placeholder={`Цель на ${half === 1 ? 'первое' : 'второе'} полугодие...`}
                                        className="flex-1 px-3 py-1.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                                      />
                                      <button
                                        onClick={() => addPeriodGoal(halfKey, 'half_year', halfDate, `H${half} ${year}`)}
                                        className={`px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r ${halfColors} hover:opacity-90 transition-opacity`}
                                      >
                                        + Добавить
                                      </button>
                                    </div>

                                    {/* Список целей полугодия */}
                                    <div className="space-y-1">
                                      {halfGoals.length === 0 ? (
                                        <div className="text-center py-4 bg-white/50 rounded-lg border border-dashed border-gray-200">
                                          <span className="text-2xl block mb-1">📋</span>
                                          <p className="text-gray-400 text-xs">
                                            Нет целей на {half === 1 ? 'первое' : 'второе'} полугодие
                                          </p>
                                        </div>
                                      ) : (
                                        halfGoals.map((goal, index) => (
                                          <div
                                            key={index}
                                            className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-100 shadow-sm"
                                          >
                                            <span className={`w-5 h-5 rounded-full bg-gradient-to-br ${halfColors} flex items-center justify-center text-white text-xs`}>
                                              {index + 1}
                                            </span>
                                            {editingGoal === `period-${halfKey}-${index}` ? (
                                              <input
                                                type="text"
                                                value={editingText}
                                                onChange={(e) => setEditingText(e.target.value)}
                                                onBlur={() => saveEditPeriodGoal(halfKey, index, 'half_year', halfDate, `H${half} ${year}`)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') saveEditPeriodGoal(halfKey, index, 'half_year', halfDate, `H${half} ${year}`)
                                                  if (e.key === 'Escape') { setEditingGoal(null); setEditingText('') }
                                                }}
                                                className="flex-1 px-2 py-0.5 text-sm border-2 border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                autoFocus
                                              />
                                            ) : (
                                              <span 
                                                className="flex-1 text-sm cursor-pointer hover:text-blue-600 transition-colors"
                                                onClick={() => startEditPeriodGoal(halfKey, index, goal)}
                                                title="Нажмите для редактирования"
                                              >
                                                {goal}
                                              </span>
                                            )}
                                            <button
                                              onClick={() => removePeriodGoal(halfKey, index, 'half_year', halfDate, `H${half} ${year}`)}
                                              className="text-red-400 hover:text-red-600 text-xs p-1 hover:bg-red-50 rounded transition-colors"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Message Toast */}
      {message && (
        <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 border border-gray-200 z-50">
          <p className="font-medium">{message}</p>
        </div>
      )}
    </div>
  )
}
