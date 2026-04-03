'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { getPeriodDates } from '@/lib/dates'
import { DailyEntry, OpenTask } from '@/lib/types'
import { areTasksSimilar } from '@/lib/task-match'

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

// Цель периода с флагом выполнения
export interface PeriodGoalItem {
  text: string
  completed: boolean
}

interface UseDailyReturn {
  selectedDate: string
  setSelectedDate: (date: string) => void
  planText: string
  setPlanText: (text: string) => void
  weekGoals: PeriodGoalItem[]
  monthGoals: PeriodGoalItem[]
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
  hasUnsavedChanges: boolean
  
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
  startEditingExtraTask: (index: number, currentText: string) => void
  saveEditedExtraTask: (index: number) => void
  cancelEditingExtraTask: () => void
  editingExtraTaskIndex: number | null
  editingExtraTaskText: string
  setEditingExtraTaskText: (text: string) => void
  addGoalToTasks: (goalText: string) => void
  removeTask: (taskId: number) => void
  postponeTask: (taskId: number, taskText: string) => Promise<void>
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
  evaluate: (router: { push: (path: string) => void }) => Promise<void>
}

export function useDaily(): UseDailyReturn {
  // Всегда начинаем с текущей даты при открытии страницы
  const [selectedDate, setSelectedDate] = useState(() => {
    return format(new Date(), 'yyyy-MM-dd')
  })
  const [planText, setPlanText] = useState('')
  const [weekGoals, setWeekGoals] = useState<PeriodGoalItem[]>([])
  const [monthGoals, setMonthGoals] = useState<PeriodGoalItem[]>([])
  const [dailyEntry, setDailyEntry] = useState<DailyEntry | null>(null)
  const [tasks, setTasks] = useState<OpenTask[]>([])
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set())
  const [extraTasks, setExtraTasks] = useState<string[]>([])
  const [newTaskText, setNewTaskText] = useState('')
  const [newExtraTaskText, setNewExtraTaskText] = useState('')
  const [saving, setSaving] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [message, setMessage] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editingTaskText, setEditingTaskText] = useState('')
  const [editingExtraTaskIndex, setEditingExtraTaskIndex] = useState<number | null>(null)
  const [editingExtraTaskText, setEditingExtraTaskText] = useState('')
  const [checkingPlan, setCheckingPlan] = useState(false)
  const [checkPlanResult, setCheckPlanResult] = useState<CheckPlanResult | null>(null)
  
  // Chat state - привязан к дате
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sendingChat, setSendingChat] = useState(false)
  
  // Функция получения ключа чата для даты
  const getChatKey = useCallback((date: string) => `daily:chat:${date}`, [])
  
  // Habits state
  const [habits, setHabits] = useState<Habit[]>([])
  const [habitSuggestions, setHabitSuggestions] = useState<HabitSuggestion[]>([])

  // Используем ref вместо state для синхронного обновления (race condition при смене даты)
  const hasLoadedOnceRef = useRef(false)

  // Track the current date to prevent race conditions when switching dates quickly
  const currentDateRef = useRef(selectedDate)

  // AbortController для отмены fetch при быстрой смене даты
  const abortControllerRef = useRef<AbortController | null>(null)
  
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('daily:selectedDate', selectedDate)
    } catch {
      // ignore
    }
  }, [selectedDate])

  // Ref для хранения текущих сообщений (избегаем зависимости от chatMessages в useEffect)
  const chatMessagesRef = useRef<ChatMessage[]>([])
  chatMessagesRef.current = chatMessages

  // Ref для предыдущей даты
  const prevDateForChatRef = useRef<string | null>(null)
  
  // Ref чтобы пропустить первое сохранение после смены даты
  const skipNextChatSaveRef = useRef(false)

  // Единый useEffect для загрузки чата при смене даты (из БД)
  useEffect(() => {
    const currentDate = selectedDate
    const prevDate = prevDateForChatRef.current
    
    // Если это та же дата - ничего не делаем
    if (prevDate === currentDate) return
    
    // Устанавливаем флаг чтобы не перезаписать загруженные данные
    skipNextChatSaveRef.current = true
    
    // Загружаем чат из БД
    const loadChatHistory = async () => {
      try {
        const res = await fetch(`/api/daily/chat/messages?date=${currentDate}`)
        if (res.ok) {
          const data = await res.json()
          const messages = (data.messages || []).map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))
          setChatMessages(messages)
        } else {
          setChatMessages([])
        }
      } catch {
        // Fallback на localStorage для обратной совместимости
        if (typeof window !== 'undefined') {
          try {
            const saved = window.localStorage.getItem(`daily:chat:${currentDate}`)
            const messages = saved ? JSON.parse(saved) : []
            setChatMessages(messages)
          } catch {
            setChatMessages([])
          }
        } else {
          setChatMessages([])
        }
      }
    }
    
    loadChatHistory()
    
    // Обновляем ref
    prevDateForChatRef.current = currentDate
  }, [selectedDate])
  
  // Сообщения теперь сохраняются на сервере через API,
  // localStorage больше не нужен для этого

  // Ref для отслеживания даты при записи черновика (чтобы не записать старые данные под новую дату)
  const draftDateRef = useRef(selectedDate)

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

  const loadData = useCallback(async (signal?: AbortSignal) => {
    // Используем ref чтобы всегда иметь актуальную дату
    const loadingDate = currentDateRef.current
    console.log('[useDaily] loadData started for:', loadingDate)

    try {
      // Load daily entry
      const dailyRes = await fetch(`/api/daily?date=${loadingDate}`, { signal })

      // Check if date changed during fetch - prevent race condition
      if (currentDateRef.current !== loadingDate) {
        console.log('[useDaily] Date changed during fetch, aborting. Was:', loadingDate, 'Now:', currentDateRef.current)
        return
      }

      if (!dailyRes.ok) {
        console.error('Failed to fetch daily entry:', dailyRes.status)
        setDailyEntry(null)
        setPlanText('')
        setTasks([])
        setSelectedTasks(new Set())
        setExtraTasks([])
      } else {
        const daily = await dailyRes.json()

        if (daily) {
          const draft = readPlanDraft(loadingDate)
          const serverUpdatedAtMs = daily.updatedAt ? new Date(daily.updatedAt).getTime() : 0
          const draftUpdatedAtMs = draft?.updatedAt ? new Date(draft.updatedAt).getTime() : 0

          const serverPlanText = (daily.planText || '').trim()
          const draftPlanText = (draft?.planText || '').trim()
          const draftHasAnything = !!draft && (
            draftPlanText.length > 0 ||
            (draft.selectedTaskIds?.length || 0) > 0 ||
            (draft.newTaskText?.trim().length || 0) > 0
          )

          // Использовать черновик только если:
          // 1. Черновик не пустой
          // 2. Сервер пустой ИЛИ (черновик новее И текст черновика отличается от сервера)
          // Это защищает от ситуации когда черновик от другой даты случайно записался под эту дату
          const draftDiffersFromServer = draftPlanText !== serverPlanText
          const shouldUseDraft = draftHasAnything && (
            serverPlanText.length === 0 ||
            (draftDiffersFromServer && draftUpdatedAtMs > serverUpdatedAtMs)
          )
          
          console.log('[useDaily] loadData for', loadingDate, {
            hasDraft: !!draft,
            draftHasAnything,
            draftDiffersFromServer,
            shouldUseDraft,
            serverPlanText: serverPlanText.substring(0, 50),
            draftPlanText: draftPlanText.substring(0, 50),
            serverUpdatedAtMs,
            draftUpdatedAtMs,
          })
          
          if (!shouldUseDraft && draft) {
            // Серверная версия новее — черновик можно смело убрать
            clearPlanDraft(loadingDate)
          }

          const effectivePlanText = shouldUseDraft ? draft!.planText : (daily.planText || '')
          const effectiveNewTaskText = shouldUseDraft ? (draft!.newTaskText || '') : ''

          setDailyEntry(daily)
          setPlanText(effectivePlanText)
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
              originDate: loadingDate,
              isClosed: false,
              createdAt: new Date().toISOString()
            }))
            setTasks(tasksWithIds)

            if (shouldUseDraft) {
              console.log('[useDaily] Using draft, selectedTaskIds:', draft!.selectedTaskIds)
              setSelectedTasks(sanitizeSelectedForTotal(draft!.selectedTaskIds, tasksWithIds.length))
            } else if (daily.selectedTasksJson) {
              try {
                const selected = JSON.parse(daily.selectedTasksJson) as (string | number)[]
                console.log('[useDaily] Loaded selectedTasksJson from DB:', selected, 'tasksCount:', tasksWithIds.length)
                const sanitized = sanitizeSelectedForTotal(selected, tasksWithIds.length)
                console.log('[useDaily] After sanitize:', Array.from(sanitized))
                setSelectedTasks(sanitized)
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
          setTasks([])
          setSelectedTasks(new Set())
          setExtraTasks([])
          // На пустой день тоже может быть черновик
          const draft = readPlanDraft(loadingDate)
          if (draft) {
            setPlanText(draft.planText)
            setNewTaskText(draft.newTaskText || '')
            const taskList = draft.planText.split('\n').filter((t) => t.trim())
            const tasksWithIds: OpenTask[] = taskList.map((text, index) => ({
              id: index + 1,
              taskText: text,
              taskType: 'operational' as const,
              originDate: loadingDate,
              isClosed: false,
              createdAt: new Date().toISOString(),
            }))
            setTasks(tasksWithIds)
            setSelectedTasks(sanitizeSelectedForTotal(draft.selectedTaskIds, tasksWithIds.length))
          }
        }
      }

      // Load week goals
      const date = new Date(loadingDate)
      const { start: weekStart } = getPeriodDates(date, 'week')
      const weekRes = await fetch(`/api/goals/period?type=week&date=${weekStart.toISOString()}`, { signal })
      if (weekRes.ok) {
        const weekData = await weekRes.json()
        setWeekGoals(weekData?.goals || [])
      } else {
        setWeekGoals([])
      }

      // Load month goals
      const { start: monthStart } = getPeriodDates(date, 'month')
      const monthRes = await fetch(`/api/goals/period?type=month&date=${monthStart.toISOString()}`, { signal })
      if (monthRes.ok) {
        const monthData = await monthRes.json()
        setMonthGoals(monthData?.goals || [])
      } else {
        setMonthGoals([])
      }

      // Load habits for today
      const habitsRes = await fetch(`/api/habits?date=${loadingDate}`, { signal })
      let loadedHabits: Habit[] = []
      if (habitsRes.ok) {
        const habitsData = await habitsRes.json()
        loadedHabits = habitsData?.habits || []
        setHabits(loadedHabits)
      } else {
        setHabits([])
      }

      // Привычки НЕ автозаполняют план — пользователь сам добавляет через кнопку "+ Все в план"

      // Load habit suggestions
      const suggestionsRes = await fetch(`/api/habits/suggestions?date=${loadingDate}`, { signal })
      if (suggestionsRes.ok) {
        const suggestionsData = await suggestionsRes.json()
        setHabitSuggestions(suggestionsData?.suggestions || [])
      } else {
        setHabitSuggestions([])
      }

      hasLoadedOnceRef.current = true
    } catch (error) {
      // Не логируем AbortError — это штатная отмена при смене даты
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.error('Error loading data:', error)
    }
  }, [readPlanDraft, clearPlanDraft, sanitizeSelectedForTotal])

  useEffect(() => {
    // Отменяем предыдущие запросы при смене даты
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    currentDateRef.current = selectedDate
    // Синхронно сбрасываем флаг чтобы предотвратить запись черновика
    hasLoadedOnceRef.current = false
    // Обновляем ref для черновика
    draftDateRef.current = selectedDate
    // Сбрасываем состояние ДО загрузки данных, чтобы не показывать старые данные
    setDailyEntry(null)
    setPlanText('')
    setTasks([])
    setSelectedTasks(new Set())
    setExtraTasks([])
    setNewTaskText('')
    // НЕ сбрасываем chatMessages — они загружаются отдельным useEffect из localStorage
    setCheckPlanResult(null)
    loadData(controller.signal)

    return () => {
      controller.abort()
    }
  }, [selectedDate]) // Intentionally not including loadData to prevent infinite loops

  // Локальный черновик плана (чтобы не пропадало при refresh)
  useEffect(() => {
    if (!hasLoadedOnceRef.current) return
    // Защита от записи черновика под неправильную дату при быстром переключении
    if (draftDateRef.current !== selectedDate) return
    
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
  }, [selectedDate, tasks, selectedTasks, newTaskText, planText, writePlanDraft])

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

      // Handle 401 - redirect to login
      if (res.status === 401) {
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname)
        return
      }

      const data = await res.json()
      if (!res.ok) {
        console.error('Failed to save plan:', res.status, data)
        showMessage(`❌ Ошибка при сохранении: ${data.error || res.status}`)
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

    // Проверяем дубликаты в extraTasks
    if (extraTasks.some(t => areTasksSimilar(t, text))) {
      showMessage('ℹ️ Похожая задача уже добавлена во внеплан', 2000)
      setNewExtraTaskText('')
      return
    }
    // Также проверяем в основных задачах
    if (tasks.some(t => areTasksSimilar(t.taskText, text))) {
      showMessage('ℹ️ Похожая задача уже есть в плане', 2000)
      setNewExtraTaskText('')
      return
    }

    const updated = [...extraTasks, text]
    setExtraTasks(updated)
    setNewExtraTaskText('')
    void saveExtraTasks(updated)
  }, [newExtraTaskText, extraTasks, tasks, saveExtraTasks, showMessage])

  const removeExtraTask = useCallback((index: number) => {
    const updated = extraTasks.filter((_, i) => i !== index)
    setExtraTasks(updated)
    void saveExtraTasks(updated)
  }, [extraTasks, saveExtraTasks])

  const startEditingExtraTask = useCallback((index: number, currentText: string) => {
    setEditingExtraTaskIndex(index)
    setEditingExtraTaskText(currentText)
  }, [])

  const saveEditedExtraTask = useCallback((index: number) => {
    if (!editingExtraTaskText.trim()) {
      setEditingExtraTaskIndex(null)
      setEditingExtraTaskText('')
      return
    }
    const updated = extraTasks.map((t, i) => (i === index ? editingExtraTaskText.trim() : t))
    setExtraTasks(updated)
    setEditingExtraTaskIndex(null)
    setEditingExtraTaskText('')
    void saveExtraTasks(updated)
  }, [editingExtraTaskText, extraTasks, saveExtraTasks])

  const cancelEditingExtraTask = useCallback(() => {
    setEditingExtraTaskIndex(null)
    setEditingExtraTaskText('')
  }, [])

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
    const text = newTaskText.trim()
    if (!text) return
    
    // Проверяем дубликаты в tasks
    if (tasks.some(t => areTasksSimilar(t.taskText, text))) {
      showMessage('Похожая задача уже есть в плане')
      return
    }
    // Проверяем дубликаты в extraTasks
    if (extraTasks.some(t => areTasksSimilar(t, text))) {
      showMessage('Похожая задача уже есть во внеплане')
      return
    }
    
    const updatedTexts = [...tasks.map((t) => t.taskText), text]
    const updatedTasks = buildTasksFromTexts(updatedTexts)
    const updatedSelected = remapSelectionByText(tasks, selectedTasks, updatedTasks)
    setTasks(updatedTasks)
    setSelectedTasks(updatedSelected)
    setNewTaskText('')
    // Отмечаем, что есть несохранённые изменения
    setHasUnsavedChanges(true)
  }, [newTaskText, tasks, selectedTasks, extraTasks, buildTasksFromTexts, remapSelectionByText, showMessage])

  const addGoalToTasks = useCallback((goalText: string) => {
    if (!goalText.trim()) return
    const trimmedGoal = goalText.trim()
    // Проверяем, нет ли уже такой или похожей задачи
    const existingTask = tasks.find(t => areTasksSimilar(t.taskText, trimmedGoal))
    if (existingTask) {
      showMessage('Похожая задача уже есть в плане')
      return
    }
    // Также проверяем в extraTasks
    if (extraTasks.some(t => areTasksSimilar(t, trimmedGoal))) {
      showMessage('Похожая задача уже есть в плане')
      return
    }
    const updatedTexts = [...tasks.map((t) => t.taskText), trimmedGoal]
    const updatedTasks = buildTasksFromTexts(updatedTexts)
    const updatedSelected = remapSelectionByText(tasks, selectedTasks, updatedTasks)
    setTasks(updatedTasks)
    setSelectedTasks(updatedSelected)
    showMessage('Цель добавлена в план')
    // Отмечаем, что есть несохранённые изменения
    setHasUnsavedChanges(true)
  }, [tasks, selectedTasks, extraTasks, buildTasksFromTexts, remapSelectionByText, showMessage])

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
    // Отмечаем, что есть несохранённые изменения
    setHasUnsavedChanges(true)
  }, [tasks, selectedTasks, buildTasksFromTexts, remapSelectionByText])

  // Перенести задачу на следующий день
  const postponeTask = useCallback(async (taskId: number, taskText: string) => {
    try {
      // Вычисляем завтрашнюю дату
      const tomorrow = format(new Date(new Date(selectedDate).getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
      
      // Отправляем на сервер
      const res = await fetch('/api/tasks/process-uncompleted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisions: [{
            taskId,
            taskText,
            action: { type: 'transfer', date: tomorrow }
          }],
          sourceDate: selectedDate
        })
      })

      if (res.ok) {
        // Удаляем задачу из текущего списка
        const updatedTexts = tasks.filter((t) => t.id !== taskId).map((t) => t.taskText)
        const updatedTasks = buildTasksFromTexts(updatedTexts)
        const updatedSelected = remapSelectionByText(tasks, selectedTasks, updatedTasks)
        setTasks(updatedTasks)
        setSelectedTasks(updatedSelected)
        setHasUnsavedChanges(true)
        showMessage('➡️ Задача перенесена на завтра')
      } else {
        showMessage('❌ Не удалось перенести задачу')
      }
    } catch (error) {
      console.error('Error postponing task:', error)
      showMessage('❌ Ошибка при переносе задачи')
    }
  }, [selectedDate, tasks, selectedTasks, buildTasksFromTexts, remapSelectionByText, showMessage])

  const toggleTaskSelection = useCallback((taskId: number) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
    // Автосохранение чекбоксов в БД
    void savePlanWithTasks(tasks, newSelected)
  }, [selectedTasks, tasks, savePlanWithTasks])

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
    // Отмечаем, что есть несохранённые изменения
    setHasUnsavedChanges(true)
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
    setHasUnsavedChanges(false)
    showMessage('✅ План сохранен!')
    setSaving(false)
  }, [savePlanWithTasks, showMessage])

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

      // Получаем текущее время пользователя
      const now = new Date()
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      const res = await fetch('/api/daily/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          currentTime,
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

  const clearChat = useCallback(async () => {
    setChatMessages([])
    setChatInput('')
    // Удаляем чат из БД
    try {
      await fetch(`/api/daily/chat/messages?date=${selectedDate}`, { method: 'DELETE' })
    } catch {
      // ignore
    }
    // Также удаляем из localStorage для совместимости
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(getChatKey(selectedDate))
      } catch {
        // ignore
      }
    }
  }, [selectedDate, getChatKey])

  const evaluate = useCallback(async (router: { push: (path: string) => void }) => {
    // Факт = отмеченные задачи
    const completedTasks = tasks.filter(t => selectedTasks.has(t.id))
    if (completedTasks.length === 0 && extraTasks.length === 0) {
      showMessage('Отметьте выполненные задачи или добавьте внеплан')
      return
    }

    setEvaluating(true)
    showMessage('Получение оценки от ИИ...', 0)

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
            selectedTasksJson: JSON.stringify(Array.from(selectedTasks)),
          }),
        })

        const savedEntry = await saveRes.json()
        if (!savedEntry?.id) {
          showMessage('Ошибка при сохранении данных')
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
        showMessage('Оценка получена!', 1500)
        setTimeout(() => {
          router.push(`/evaluation/${selectedDate}`)
        }, 1500)
      } else {
        const error = await res.json()
        showMessage(`Ошибка: ${error.error}`)
      }
    } catch (error) {
      console.error('Error evaluating:', error)
      showMessage('Ошибка при получении оценки')
    } finally {
      setEvaluating(false)
    }
  }, [dailyEntry, tasks, selectedDate, selectedTasks, extraTasks, showMessage])

  return {
    selectedDate,
    setSelectedDate,
    planText,
    setPlanText,
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
    hasUnsavedChanges,
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
    startEditingExtraTask,
    saveEditedExtraTask,
    cancelEditingExtraTask,
    editingExtraTaskIndex,
    editingExtraTaskText,
    setEditingExtraTaskText,
    addGoalToTasks,
    removeTask,
    postponeTask,
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
    evaluate,
    // Habits
    habits,
    habitSuggestions,
    addHabitsToTasks,
    createHabitFromTask,
    deleteHabit,
  }
}
