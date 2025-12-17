'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { getPeriodDates } from '@/lib/dates'
import { DailyEntry, OpenTask } from '@/lib/types'

type DailyPlanDraft = {
  updatedAt: string
  planText: string
  selectedTaskIds: number[]
  newTaskText?: string
}

// Типы для проверки плана
export interface TaskSuggestion {
  goalText: string
  reason: string
  difficulty: 'легко' | 'средне' | 'сложно'
  source: 'week' | 'month'
}

export interface CheckPlanResult {
  overall: string
  suggestions: TaskSuggestion[]
  warnings: string[]
  tips: string[]
}

// Типы для чата
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Типы для привычек
export interface Habit {
  id: number
  taskText: string
  frequency: string
  daysOfWeek: string | null
  interval: number | null
  isActive: boolean
  streak: number
  bestStreak: number
  totalDone: number
  sortOrder: number
}

export interface HabitSuggestion {
  text: string
  consecutiveDays: number
  totalCount: number
  reason: string
}

interface UseDailyReturn {
  selectedDate: string
  setSelectedDate: (date: string) => void
  planText: string
  setPlanText: (text: string) => void
  factText: string
  setFactText: (text: string) => void
  weekGoals: string[]
  monthGoals: string[]
  dailyEntry: DailyEntry | null
  tasks: OpenTask[]
  selectedTasks: Set<number>
  extraTasks: string[]
  newExtraTaskText: string
  setNewExtraTaskText: (text: string) => void
  newTaskText: string
  setNewTaskText: (text: string) => void
  saving: boolean
  evaluating: boolean
  message: string
  
  // Habits
  habits: Habit[]
  habitSuggestions: HabitSuggestion[]
  addHabitsToTasks: (habitTexts?: string[]) => void
  createHabitFromTask: (taskText: string, frequency?: string, daysOfWeek?: number[]) => Promise<void>
  deleteHabit: (habitId: number) => Promise<void>
  
  // Check plan (deprecated - используй чат)
  checkingPlan: boolean
  checkPlanResult: CheckPlanResult | null
  checkPlan: () => Promise<void>
  clearCheckPlanResult: () => void
  
  // Chat with AI
  chatMessages: ChatMessage[]
  chatInput: string
  setChatInput: (text: string) => void
  sendChatMessage: (initialMessage?: string) => Promise<void>
  sendingChat: boolean
  clearChat: () => void
  
  // Task operations
  addTask: () => void
  addExtraTask: () => void
  removeExtraTask: (index: number) => void
  addGoalToTasks: (goalText: string) => void
  removeTask: (taskId: number) => void
  toggleTaskSelection: (taskId: number) => void
  startEditingTask: (taskId: number, currentText: string) => void
  saveEditedTask: (taskId: number) => void
  cancelEditingTask: () => void
  editingTaskId: number | null
  editingTaskText: string
  setEditingTaskText: (text: string) => void
  
  // Drag and drop
  draggedTaskId: number | null
  handleDragStart: (taskId: number) => void
  handleDragOver: (e: React.DragEvent) => void
  handleDrop: (targetTaskId: number) => void
  
  // Save operations
  savePlan: () => Promise<void>
  saveFact: () => Promise<void>
  transferCompletedTasks: () => void
  evaluate: (router: { push: (path: string) => void }) => Promise<void>
}

export function useDaily(): UseDailyReturn {
  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('daily:selectedDate')
      if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) return saved
    }
    return format(new Date(), 'yyyy-MM-dd')
  })
  const [planText, setPlanText] = useState('')
  const [factText, setFactText] = useState('')
  const [weekGoals, setWeekGoals] = useState<string[]>([])
  const [monthGoals, setMonthGoals] = useState<string[]>([])
  const [dailyEntry, setDailyEntry] = useState<DailyEntry | null>(null)
  const [tasks, setTasks] = useState<OpenTask[]>([])
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set())
  const [extraTasks, setExtraTasks] = useState<string[]>([])
  const [newTaskText, setNewTaskText] = useState('')
  const [newExtraTaskText, setNewExtraTaskText] = useState('')
  const [saving, setSaving] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [message, setMessage] = useState('')
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editingTaskText, setEditingTaskText] = useState('')
  const [checkingPlan, setCheckingPlan] = useState(false)
  const [checkPlanResult, setCheckPlanResult] = useState<CheckPlanResult | null>(null)
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sendingChat, setSendingChat] = useState(false)
  
  // Habits state
  const [habits, setHabits] = useState<Habit[]>([])
  const [habitSuggestions, setHabitSuggestions] = useState<HabitSuggestion[]>([])

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  // Track the current date to prevent race conditions when switching dates quickly
  const currentDateRef = useRef(selectedDate)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('daily:selectedDate', selectedDate)
    } catch {
      // ignore
    }
  }, [selectedDate])

  useEffect(() => {
    // Prevent stale state from previous date being persisted under the new date.
    setHasLoadedOnce(false)
  }, [selectedDate])

  const getPlanDraftKey = useCallback((date: string) => `daily:planDraft:${date}`, [])

  const readPlanDraft = useCallback((date: string): DailyPlanDraft | null => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(getPlanDraftKey(date))
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<DailyPlanDraft>
      if (!parsed || typeof parsed !== 'object') return null
      if (typeof parsed.updatedAt !== 'string') return null
      if (typeof parsed.planText !== 'string') return null
      if (!Array.isArray(parsed.selectedTaskIds)) return null
      const selectedTaskIds = parsed.selectedTaskIds
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n))
        .map((n) => Math.trunc(n))

      return {
        updatedAt: parsed.updatedAt,
        planText: parsed.planText,
        selectedTaskIds,
        newTaskText: typeof parsed.newTaskText === 'string' ? parsed.newTaskText : undefined,
      }
    } catch {
      return null
    }
  }, [getPlanDraftKey])

  const writePlanDraft = useCallback((date: string, draft: DailyPlanDraft) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(getPlanDraftKey(date), JSON.stringify(draft))
    } catch {
      // ignore
    }
  }, [getPlanDraftKey])

  const clearPlanDraft = useCallback((date: string) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(getPlanDraftKey(date))
    } catch {
      // ignore
    }
  }, [getPlanDraftKey])

  const sanitizeSelectedForTotal = useCallback((selected: (string | number)[], total: number): Set<number> => {
    if (total <= 0) return new Set()
    const result = new Set<number>()
    for (const raw of selected) {
      const id = Number(raw)
      if (!Number.isFinite(id)) continue
      const rounded = Math.trunc(id)
      if (rounded >= 1 && rounded <= total) {
        result.add(rounded)
      }
    }
    return result
  }, [])

  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const showMessage = useCallback((text: string, duration = 3000) => {
    // Clear previous timeout to prevent memory leaks
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current)
      messageTimeoutRef.current = null
    }
    setMessage(text)
    if (duration > 0) {
      messageTimeoutRef.current = setTimeout(() => {
        setMessage('')
        messageTimeoutRef.current = null
      }, duration)
    }
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current)
      }
    }
  }, [])

  const loadData = useCallback(async () => {
    // Capture the date we're loading for to check later
    const loadingDate = selectedDate

    try {
      // Load daily entry
      const dailyRes = await fetch(`/api/daily?date=${selectedDate}`)

      // Check if date changed during fetch - prevent race condition
      if (currentDateRef.current !== loadingDate) return

      if (!dailyRes.ok) {
        console.error('Failed to fetch daily entry:', dailyRes.status)
        setDailyEntry(null)
        setPlanText('')
        setFactText('')
        setTasks([])
        setSelectedTasks(new Set())
        setExtraTasks([])
      } else {
        const daily = await dailyRes.json()

        if (daily) {
          const draft = readPlanDraft(selectedDate)
          const serverUpdatedAtMs = daily.updatedAt ? new Date(daily.updatedAt).getTime() : 0
          const draftUpdatedAtMs = draft?.updatedAt ? new Date(draft.updatedAt).getTime() : 0

          const serverPlanText = (daily.planText || '').trim()
          const draftPlanText = (draft?.planText || '').trim()
          const draftHasAnything = !!draft && (
            draftPlanText.length > 0 ||
            (draft.selectedTaskIds?.length || 0) > 0 ||
            (draft.newTaskText?.trim().length || 0) > 0
          )

          // Never let an empty draft override a non-empty saved plan.
          const shouldUseDraft = draftHasAnything && (
            serverPlanText.length === 0 ||
            (!serverUpdatedAtMs || draftUpdatedAtMs > serverUpdatedAtMs)
          )
          if (!shouldUseDraft && draft) {
            // Серверная версия новее — черновик можно смело убрать
            clearPlanDraft(selectedDate)
          }

          const effectivePlanText = shouldUseDraft ? draft!.planText : (daily.planText || '')
          const effectiveFactText = daily.factText || ''
          const effectiveNewTaskText = shouldUseDraft ? (draft!.newTaskText || '') : ''

          setDailyEntry(daily)
          setPlanText(effectivePlanText)
          setFactText(effectiveFactText)
          setNewTaskText(effectiveNewTaskText)

          // Extra tasks (перевыполнение)
          try {
            const parsed = daily.extraTasksJson ? (JSON.parse(daily.extraTasksJson) as unknown) : []
            setExtraTasks(
              Array.isArray(parsed)
                ? parsed.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
                : []
            )
          } catch {
            setExtraTasks([])
          }

          if (effectivePlanText) {
            const taskList = effectivePlanText.split('\n').filter((t: string) => t.trim())
            const tasksWithIds: OpenTask[] = taskList.map((text: string, index: number) => ({
              id: index + 1,
              taskText: text,
              taskType: 'operational' as const,
              originDate: selectedDate,
              isClosed: false,
              createdAt: new Date().toISOString()
            }))
            setTasks(tasksWithIds)

            if (shouldUseDraft) {
              setSelectedTasks(sanitizeSelectedForTotal(draft!.selectedTaskIds, tasksWithIds.length))
            } else if (daily.selectedTasksJson) {
              try {
                const selected = JSON.parse(daily.selectedTasksJson) as (string | number)[]
                setSelectedTasks(sanitizeSelectedForTotal(selected, tasksWithIds.length))
              } catch {
                setSelectedTasks(new Set())
              }
            } else {
              setSelectedTasks(new Set())
            }
          } else {
            setTasks([])
            // Нет плана — нет и валидных отмеченных задач
            setSelectedTasks(new Set())
          }
        } else {
          setDailyEntry(null)
          setPlanText('')
          setFactText('')
          setTasks([])
          setSelectedTasks(new Set())
          setExtraTasks([])
          // На пустой день тоже может быть черновик
          const draft = readPlanDraft(selectedDate)
          if (draft) {
            setPlanText(draft.planText)
            setNewTaskText(draft.newTaskText || '')
            const taskList = draft.planText.split('\n').filter((t) => t.trim())
            const tasksWithIds: OpenTask[] = taskList.map((text, index) => ({
              id: index + 1,
              taskText: text,
              taskType: 'operational' as const,
              originDate: selectedDate,
              isClosed: false,
              createdAt: new Date().toISOString(),
            }))
            setTasks(tasksWithIds)
            setSelectedTasks(sanitizeSelectedForTotal(draft.selectedTaskIds, tasksWithIds.length))
          }
        }
      }

      // Load week goals
      const date = new Date(selectedDate)
      const { start: weekStart } = getPeriodDates(date, 'week')
      const weekRes = await fetch(`/api/goals/period?type=week&date=${weekStart.toISOString()}`)
      if (weekRes.ok) {
        const weekData = await weekRes.json()
        setWeekGoals(weekData?.goals || [])
      } else {
        setWeekGoals([])
      }

      // Load month goals
      const { start: monthStart } = getPeriodDates(date, 'month')
      const monthRes = await fetch(`/api/goals/period?type=month&date=${monthStart.toISOString()}`)
      if (monthRes.ok) {
        const monthData = await monthRes.json()
        setMonthGoals(monthData?.goals || [])
      } else {
        setMonthGoals([])
      }

      // Load habits for today
      const habitsRes = await fetch(`/api/habits?date=${selectedDate}`)
      let loadedHabits: Habit[] = []
      if (habitsRes.ok) {
        const habitsData = await habitsRes.json()
        loadedHabits = habitsData?.habits || []
        setHabits(loadedHabits)
      } else {
        setHabits([])
      }

      // Если день пустой — автоматически добавляем привычки в задачи.
      // Важно: не затираем локальный черновик.
      const hasPlan = tasks.length > 0 || planText.trim().length > 0
      if (!hasPlan && loadedHabits.length > 0) {
        // День пустой — добавляем привычки
        const habitTasks: OpenTask[] = loadedHabits.map((habit, index) => ({
          id: index + 1,
          taskText: habit.taskText,
          taskType: 'operational' as const,
          originDate: selectedDate,
          isClosed: false,
          createdAt: new Date().toISOString()
        }))
        setTasks(habitTasks)
        // Не сохраняем сразу — пользователь может захотеть что-то добавить
      }

      // Load habit suggestions
      const suggestionsRes = await fetch(`/api/habits/suggestions?date=${selectedDate}`)
      if (suggestionsRes.ok) {
        const suggestionsData = await suggestionsRes.json()
        setHabitSuggestions(suggestionsData?.suggestions || [])
      } else {
        setHabitSuggestions([])
      }

      setHasLoadedOnce(true)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }, [selectedDate, planText, tasks, readPlanDraft, clearPlanDraft, sanitizeSelectedForTotal])

  useEffect(() => {
    currentDateRef.current = selectedDate
    loadData()
  }, [selectedDate]) // Intentionally not including loadData to prevent infinite loops

  // Локальный черновик плана (чтобы не пропадало при refresh)
  useEffect(() => {
    if (!hasLoadedOnce) return
    const planTextDraft = tasks.length > 0
      ? tasks.map((t) => t.taskText).join('\n')
      : planText
    const selectedTaskIds = Array.from(selectedTasks)

    const hasAnything =
      planTextDraft.trim().length > 0 ||
      selectedTaskIds.length > 0 ||
      newTaskText.trim().length > 0

    // Don't overwrite an existing draft with an empty one.
    if (!hasAnything) return

    const draft: DailyPlanDraft = {
      updatedAt: new Date().toISOString(),
      planText: planTextDraft,
      selectedTaskIds,
      newTaskText: newTaskText,
    }
    writePlanDraft(selectedDate, draft)
  }, [hasLoadedOnce, selectedDate, tasks, selectedTasks, newTaskText, writePlanDraft])

  const savePlanWithTasks = useCallback(async (
    taskList: OpenTask[] = tasks,
    selected: Set<number> = selectedTasks
  ) => {
    const planTextToSave = taskList.map(t => t.taskText).join('\n')

    const allowedIds = new Set(taskList.map(t => t.id))
    const sanitizedSelected = Array.from(selected).filter(id => allowedIds.has(id))

    try {
      const res = await fetch('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          planText: planTextToSave,
          selectedTasksJson: JSON.stringify(sanitizedSelected),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        console.error('Failed to save plan:', data)
        showMessage('❌ Ошибка при сохранении')
        return
      }
      // Update local state immediately so UI (saved/draft indicators) reacts even if
      // the API response is stale/cached for some reason.
      setDailyEntry((prev) => ({
        ...(prev || data),
        ...data,
        planText: planTextToSave,
        selectedTasksJson: JSON.stringify(sanitizedSelected),
        updatedAt: new Date().toISOString(),
      }))
      setPlanText(planTextToSave)
      clearPlanDraft(selectedDate)
    } catch (error) {
      console.error('Error saving plan:', error)
      showMessage('❌ Ошибка при сохранении')
    }
  }, [tasks, selectedTasks, selectedDate, showMessage, clearPlanDraft])

  const saveExtraTasks = useCallback(async (tasksToSave: string[]) => {
    try {
      await fetch('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          extraTasksJson: JSON.stringify(tasksToSave),
        }),
      })
    } catch (error) {
      console.error('Error saving extra tasks:', error)
      showMessage('❌ Ошибка при сохранении', 2000)
    }
  }, [selectedDate, showMessage])

  const addExtraTask = useCallback(() => {
    const text = newExtraTaskText.trim()
    if (!text) return

    const existingLower = new Set(extraTasks.map(t => t.toLowerCase()))
    if (existingLower.has(text.toLowerCase())) {
      showMessage('ℹ️ Уже добавлено во внеплан', 2000)
      setNewExtraTaskText('')
      return
    }

    const updated = [...extraTasks, text]
    setExtraTasks(updated)
    setNewExtraTaskText('')
    void saveExtraTasks(updated)
  }, [newExtraTaskText, extraTasks, saveExtraTasks, showMessage])

  const removeExtraTask = useCallback((index: number) => {
    const updated = extraTasks.filter((_, i) => i !== index)
    setExtraTasks(updated)
    void saveExtraTasks(updated)
  }, [extraTasks, saveExtraTasks])

  const buildTasksFromTexts = useCallback((texts: string[]): OpenTask[] => {
    return texts
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((text, index) => ({
        id: index + 1,
        taskText: text,
        taskType: 'operational' as const,
        originDate: selectedDate,
        isClosed: false,
        createdAt: new Date().toISOString(),
      }))
  }, [selectedDate])

  const remapSelectionByText = useCallback((
    prevTasks: OpenTask[],
    prevSelected: Set<number>,
    nextTasks: OpenTask[]
  ): Set<number> => {
    const selectedTexts = prevTasks
      .filter((t) => prevSelected.has(t.id))
      .map((t) => t.taskText.trim().toLowerCase())
      .filter((t) => t.length > 0)

    const counts = new Map<string, number>()
    for (const text of selectedTexts) {
      counts.set(text, (counts.get(text) || 0) + 1)
    }

    const nextSelected = new Set<number>()
    for (const task of nextTasks) {
      const key = task.taskText.trim().toLowerCase()
      const c = counts.get(key) || 0
      if (c > 0) {
        nextSelected.add(task.id)
        if (c === 1) counts.delete(key)
        else counts.set(key, c - 1)
      }
    }

    return nextSelected
  }, [])

  const addTask = useCallback(() => {
    if (!newTaskText.trim()) return
    const updatedTexts = [...tasks.map((t) => t.taskText), newTaskText.trim()]
    const updatedTasks = buildTasksFromTexts(updatedTexts)
    const updatedSelected = remapSelectionByText(tasks, selectedTasks, updatedTasks)
    setTasks(updatedTasks)
    setSelectedTasks(updatedSelected)
    setNewTaskText('')
  }, [newTaskText, tasks, selectedTasks, buildTasksFromTexts, remapSelectionByText])

  const addGoalToTasks = useCallback((goalText: string) => {
    if (!goalText.trim()) return
    // Проверяем, нет ли уже такой задачи
    if (tasks.some(t => t.taskText === goalText.trim())) {
      showMessage('Эта задача уже добавлена')
      return
    }
    const updatedTexts = [...tasks.map((t) => t.taskText), goalText.trim()]
    const updatedTasks = buildTasksFromTexts(updatedTexts)
    const updatedSelected = remapSelectionByText(tasks, selectedTasks, updatedTasks)
    setTasks(updatedTasks)
    setSelectedTasks(updatedSelected)
    showMessage('Цель добавлена в план')
  }, [tasks, selectedTasks, buildTasksFromTexts, remapSelectionByText, showMessage])

  // Добавить привычки в задачи
  const addHabitsToTasks = useCallback((habitTexts?: string[]) => {
    // Если не переданы тексты, берём из текущих активных привычек
    const textsToAdd = habitTexts ?? habits.map(h => h.taskText)
    
    if (textsToAdd.length === 0) return
    
    // Фильтруем уже добавленные
    const existingTexts = new Set(tasks.map(t => t.taskText.toLowerCase()))
    const newHabitTexts = textsToAdd.filter(text => !existingTexts.has(text.toLowerCase()))
    
    if (newHabitTexts.length === 0) {
      showMessage('ℹ️ Все привычки уже в плане')
      return
    }

    const updatedTexts = [...tasks.map((t) => t.taskText), ...newHabitTexts]
    const updatedTasks = buildTasksFromTexts(updatedTexts)
    const updatedSelected = remapSelectionByText(tasks, selectedTasks, updatedTasks)
    setTasks(updatedTasks)
    setSelectedTasks(updatedSelected)
    showMessage(`✅ Добавлено ${newHabitTexts.length} ${newHabitTexts.length === 1 ? 'привычка' : 'привычек'}`)
  }, [tasks, selectedTasks, habits, buildTasksFromTexts, remapSelectionByText, showMessage])

  // Создать привычку из задачи
  const createHabitFromTask = useCallback(async (
    taskText: string, 
    frequency: string = 'daily',
    daysOfWeek?: number[]
  ) => {
    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskText,
          frequency,
          daysOfWeek,
        }),
      })

      if (res.ok) {
        const habit = await res.json()
        setHabits(prev => [...prev, habit])
        // Убрать из предложений
        setHabitSuggestions(prev => prev.filter(s => s.text !== taskText))
        showMessage('🔄 Привычка создана!')
      } else {
        showMessage('❌ Не удалось создать привычку')
      }
    } catch (error) {
      console.error('Error creating habit:', error)
      showMessage('❌ Ошибка при создании привычки')
    }
  }, [showMessage])

  // Удалить привычку
  const deleteHabit = useCallback(async (habitId: number) => {
    try {
      const res = await fetch(`/api/habits?id=${habitId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setHabits(prev => prev.filter(h => h.id !== habitId))
        showMessage('🗑️ Привычка удалена')
      } else {
        showMessage('❌ Не удалось удалить привычку')
      }
    } catch (error) {
      console.error('Error deleting habit:', error)
      showMessage('❌ Ошибка при удалении привычки')
    }
  }, [showMessage])

  const removeTask = useCallback((taskId: number) => {
    const updatedTexts = tasks.filter((t) => t.id !== taskId).map((t) => t.taskText)
    const updatedTasks = buildTasksFromTexts(updatedTexts)
    const updatedSelected = remapSelectionByText(tasks, selectedTasks, updatedTasks)
    setTasks(updatedTasks)
    setSelectedTasks(updatedSelected)
  }, [tasks, selectedTasks, buildTasksFromTexts, remapSelectionByText])

  const toggleTaskSelection = useCallback((taskId: number) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
  }, [selectedTasks])

  const startEditingTask = useCallback((taskId: number, currentText: string) => {
    setEditingTaskId(taskId)
    setEditingTaskText(currentText)
  }, [])

  const saveEditedTask = useCallback((taskId: number) => {
    if (!editingTaskText.trim()) {
      setEditingTaskId(null)
      setEditingTaskText('')
      return
    }

    const updatedTexts = tasks.map((t) => (t.id === taskId ? editingTaskText.trim() : t.taskText))
    const updatedTasks = buildTasksFromTexts(updatedTexts)
    const updatedSelected = remapSelectionByText(tasks, selectedTasks, updatedTasks)
    setTasks(updatedTasks)
    setSelectedTasks(updatedSelected)
    setEditingTaskId(null)
    setEditingTaskText('')
  }, [editingTaskText, tasks, selectedTasks, buildTasksFromTexts, remapSelectionByText])

  const cancelEditingTask = useCallback(() => {
    setEditingTaskId(null)
    setEditingTaskText('')
  }, [])

  const handleDragStart = useCallback((taskId: number) => {
    setDraggedTaskId(taskId)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback((targetTaskId: number) => {
    if (!draggedTaskId || draggedTaskId === targetTaskId) return

    const draggedIndex = tasks.findIndex(t => t.id === draggedTaskId)
    const targetIndex = tasks.findIndex(t => t.id === targetTaskId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const reordered = [...tasks]
    const [draggedTask] = reordered.splice(draggedIndex, 1)
    reordered.splice(targetIndex, 0, draggedTask)
    const reorderedTexts = reordered.map((t) => t.taskText)
    const newTasks = buildTasksFromTexts(reorderedTexts)
    const updatedSelected = remapSelectionByText(tasks, selectedTasks, newTasks)

    setTasks(newTasks)
    setSelectedTasks(updatedSelected)
    setDraggedTaskId(null)
  }, [draggedTaskId, tasks, selectedTasks, buildTasksFromTexts, remapSelectionByText])

  const savePlan = useCallback(async () => {
    setSaving(true)
    await savePlanWithTasks()
    showMessage('✅ План сохранен!')
    setSaving(false)
  }, [savePlanWithTasks, showMessage])

  const saveFact = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          factText,
        }),
      })

      const data = await res.json()
      setDailyEntry(data)
      showMessage('✅ Факт сохранен!')
    } catch (error) {
      console.error('Error saving fact:', error)
      showMessage('❌ Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }, [selectedDate, factText, showMessage])

  const transferCompletedTasks = useCallback(() => {
    if (selectedTasks.size === 0) {
      showMessage('ℹ️ Выберите задачи для переноса', 2000)
      return
    }

    const tasksToTransfer: string[] = []
    tasks.forEach((task) => {
      if (selectedTasks.has(task.id)) {
        tasksToTransfer.push(task.taskText)
      }
    })

    const currentFact = factText.trim()
    const newFact = currentFact
      ? `${currentFact}\n${tasksToTransfer.join('\n')}`
      : tasksToTransfer.join('\n')
    setFactText(newFact)

    showMessage(`✅ Перенесено ${tasksToTransfer.length} ${tasksToTransfer.length === 1 ? 'задача' : tasksToTransfer.length < 5 ? 'задачи' : 'задач'}`)
  }, [selectedTasks, tasks, factText, showMessage])

  // Проверка плана ИИ
  const checkPlan = useCallback(async () => {
    if (tasks.length === 0) {
      showMessage('ℹ️ Добавьте хотя бы одну задачу')
      return
    }

    setCheckingPlan(true)
    setCheckPlanResult(null)
    showMessage('🔍 Проверяю план...', 0)

    try {
      const planTasks = tasks.map(t => t.taskText)

      const res = await fetch('/api/daily/check-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          planTasks,
        }),
      })

      if (res.ok) {
        const result: CheckPlanResult = await res.json()
        setCheckPlanResult(result)
        setMessage('')
      } else {
        const error = await res.json()
        showMessage(`❌ Ошибка: ${error.error}`)
      }
    } catch (error) {
      console.error('Error checking plan:', error)
      showMessage('❌ Ошибка при проверке плана')
    } finally {
      setCheckingPlan(false)
    }
  }, [tasks, selectedDate, showMessage])

  const clearCheckPlanResult = useCallback(() => {
    setCheckPlanResult(null)
  }, [])

  // Chat functions
  const sendChatMessage = useCallback(async (initialMessage?: string) => {
    const messageToSend = initialMessage || chatInput.trim()
    if (!messageToSend) return
    
    if (tasks.length === 0) {
      showMessage('ℹ️ Сначала добавьте задачи в план')
      return
    }

    setSendingChat(true)
    
    // Добавить сообщение пользователя в историю (если не initialMessage)
    const newUserMessage: ChatMessage = { role: 'user', content: messageToSend }
    const updatedMessages = initialMessage 
      ? chatMessages // При initial message не добавляем в UI - это системный запрос
      : [...chatMessages, newUserMessage]
    
    if (!initialMessage) {
      setChatMessages(updatedMessages)
      setChatInput('')
    }

    try {
      const planTasks = tasks.map(t => t.taskText)
      const completedTasks = tasks
        .filter(t => selectedTasks.has(t.id))
        .map(t => t.taskText)

      const res = await fetch('/api/daily/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          planTasks,
          completedTasks,
          messages: chatMessages,
          userMessage: messageToSend,
        }),
      })

      if (res.ok) {
        const { message: aiMessage } = await res.json()
        const assistantMessage: ChatMessage = { role: 'assistant', content: aiMessage }
        setChatMessages(prev => [...prev, 
          ...(initialMessage ? [newUserMessage] : []), 
          assistantMessage
        ])
      } else {
        const error = await res.json()
        showMessage(`❌ Ошибка: ${error.error}`)
      }
    } catch (error) {
      console.error('Error sending chat message:', error)
      showMessage('❌ Ошибка при отправке сообщения')
    } finally {
      setSendingChat(false)
    }
  }, [chatInput, chatMessages, tasks, selectedTasks, selectedDate, showMessage])

  const clearChat = useCallback(() => {
    setChatMessages([])
    setChatInput('')
  }, [])

  const evaluate = useCallback(async (router: { push: (path: string) => void }) => {
    // Факт = отмеченные задачи
    const completedTasks = tasks.filter(t => selectedTasks.has(t.id))
    if (completedTasks.length === 0 && extraTasks.length === 0) {
      showMessage('❌ Отметьте выполненные задачи или добавьте внеплан')
      return
    }

    setEvaluating(true)
    showMessage('⏳ Получение оценки от ИИ...', 0)

    try {
      let entryId = dailyEntry?.id

      if (!entryId) {
        const planTextToSave = tasks.map(t => t.taskText).join('\n')
        const saveRes = await fetch('/api/daily', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: selectedDate,
            planText: planTextToSave,
            factText,
            selectedTasksJson: JSON.stringify(Array.from(selectedTasks)),
          }),
        })

        const savedEntry = await saveRes.json()
        if (!savedEntry?.id) {
          showMessage('❌ Ошибка при сохранении данных')
          setEvaluating(false)
          return
        }

        entryId = savedEntry.id
        setDailyEntry(savedEntry)
      }

      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyEntryId: entryId,
        }),
      })

      if (res.ok) {
        showMessage('✅ Оценка получена!')
        setTimeout(() => {
          router.push(`/evaluation/${selectedDate}`)
        }, 1000)
      } else {
        const error = await res.json()
        showMessage(`❌ Ошибка: ${error.error}`)
      }
    } catch (error) {
      console.error('Error evaluating:', error)
      showMessage('❌ Ошибка при получении оценки')
    } finally {
      setEvaluating(false)
    }
  }, [factText, dailyEntry, tasks, selectedDate, selectedTasks, extraTasks, showMessage])

  return {
    selectedDate,
    setSelectedDate,
    planText,
    setPlanText,
    factText,
    setFactText,
    weekGoals,
    monthGoals,
    dailyEntry,
    tasks,
    selectedTasks,
    extraTasks,
    newExtraTaskText,
    setNewExtraTaskText,
    newTaskText,
    setNewTaskText,
    saving,
    evaluating,
    message,
    checkingPlan,
    checkPlanResult,
    checkPlan,
    clearCheckPlanResult,
    chatMessages,
    chatInput,
    setChatInput,
    sendChatMessage,
    sendingChat,
    clearChat,
    addTask,
    addExtraTask,
    removeExtraTask,
    addGoalToTasks,
    removeTask,
    toggleTaskSelection,
    startEditingTask,
    saveEditedTask,
    cancelEditingTask,
    editingTaskId,
    editingTaskText,
    setEditingTaskText,
    draggedTaskId,
    handleDragStart,
    handleDragOver,
    handleDrop,
    savePlan,
    saveFact,
    transferCompletedTasks,
    evaluate,
    // Habits
    habits,
    habitSuggestions,
    addHabitsToTasks,
    createHabitFromTask,
    deleteHabit,
  }
}
