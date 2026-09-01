'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { getPeriodDates } from '@/lib/dates'
import type { DailyEntry, OpenTask } from '@/lib/types'
import { areTasksSimilar } from '@/lib/task-match'
import { FetchJsonError, expectOk, fetchJson, getFetchErrorMessage } from '@/lib/fetch-json'
import { useAuth } from '@/components/AuthProvider'
import type { ChatMessage, CheckPlanResult, DailyPlanDraft, Habit, HabitSuggestion, PeriodGoalItem, UseDailyReturn } from './types'
import { clearPlanDraftFromStorage, getDailyChatStorageKey, readPlanDraftFromStorage, sweepLegacyDailyStorage, writePlanDraftToStorage } from './plan-draft'
import {
  buildTasksFromTexts as buildTasksFromTextsForDate,
  parseExtraTasksJson,
  parseSelectedTasksJson,
  preserveSelectionByTaskIds,
  remapSelectionByText as remapSelectionByTextForTasks,
  mergeAppliedPlanTasks,
  sanitizeSelectedForTotal,
} from './task-helpers'
import { getBrowserTimezone, isPendingChatMessageId, normalizeChatMessageId } from './chat-helpers'
import { consumeDailyChatSseStream, DailyChatSseError } from './stream-consumer'
import { shouldKickoffPlanChat, shouldShowPlanChatKickoffCta, SYSTEM_KICKOFF_PLAN_CHAT } from './kickoff-helpers'
import { getDailyChatDraftKey } from '@/hooks/chat-viewport-helpers'
import { isDateKey, subscribeDailyDate, writeStoredDailyDate } from '@/lib/daily-date-sync'

let dailyChatTempMessageIdCounter = 0

export function createDailyChatTempMessageId(prefix: 'local-user' | 'pending'): string {
  dailyChatTempMessageIdCounter += 1
  const uniquePart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Date.now()
  return `${prefix}-${dailyChatTempMessageIdCounter}-${uniquePart}`
}

export function getDailyChatMessageRenderKey(message: Pick<ChatMessage, 'id'>, index: number): string {
  return message.id ?? `idx-${index}`
}

export function useDaily(): UseDailyReturn {
  const { user } = useAuth()
  const storageUserId = user?.id ?? null
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
  const [saving, setSaving] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [message, setMessage] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editingTaskText, setEditingTaskText] = useState('')
  const [checkingPlan, setCheckingPlan] = useState(false)
  const [checkPlanResult, setCheckPlanResult] = useState<CheckPlanResult | null>(null)
  
  // Chat state - привязан к дате
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sendingChat, setSendingChat] = useState(false)
  // Свежепришедшее предложение расписания, которое страница должна применить в фоне
  const [pendingAutoApplyScheduleProposalId, setPendingAutoApplyScheduleProposalId] = useState<string | null>(null)
  const [chatHistoryLoadedDate, setChatHistoryLoadedDate] = useState<string | null>(null)
  
  // Функция получения ключа чата для даты
  const getChatKey = useCallback((date: string) => storageUserId ? getDailyChatStorageKey(storageUserId, date) : null, [storageUserId])
  
  // Habits state
  const [habits, setHabits] = useState<Habit[]>([])
  const [habitSuggestions, setHabitSuggestions] = useState<HabitSuggestion[]>([])

  // Используем ref вместо state для синхронного обновления (race condition при смене даты)
  const hasLoadedOnceRef = useRef(false)

  // Track the current date to prevent race conditions when switching dates quickly
  const currentDateRef = useRef(selectedDate)

  // Черновик сообщения хранится только в рамках вкладки и отдельно для каждой даты.
  const chatDraftDateRef = useRef(selectedDate)
  const skipChatDraftSaveForDateRef = useRef<string | null>(selectedDate)

  const clearChatDraft = useCallback((date: string) => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.removeItem(getDailyChatDraftKey(date))
    } catch {
      // Storage может быть недоступен в privacy mode.
    }
  }, [])

  useEffect(() => {
    const draftDate = selectedDate
    chatDraftDateRef.current = draftDate
    skipChatDraftSaveForDateRef.current = draftDate

    if (typeof window === 'undefined') {
      setChatInput('')
      return
    }

    try {
      setChatInput(window.sessionStorage.getItem(getDailyChatDraftKey(draftDate)) ?? '')
    } catch {
      setChatInput('')
    }
  }, [selectedDate])

  useEffect(() => {
    if (chatDraftDateRef.current !== selectedDate) return
    if (skipChatDraftSaveForDateRef.current === selectedDate) {
      skipChatDraftSaveForDateRef.current = null
      return
    }
    if (typeof window === 'undefined') return

    try {
      const key = getDailyChatDraftKey(selectedDate)
      if (chatInput) window.sessionStorage.setItem(key, chatInput)
      else window.sessionStorage.removeItem(key)
    } catch {
      // Storage может быть недоступен в privacy mode.
    }
  }, [chatInput, selectedDate])

  // AbortController для отмены fetch при быстрой смене даты
  const abortControllerRef = useRef<AbortController | null>(null)
  
  useEffect(() => {
    // Пишет localStorage и оповещает закреплённую дату в шапке (HeaderDailyDate)
    writeStoredDailyDate(selectedDate)
  }, [selectedDate])

  // Дата из шапки: событие при смене на этой странице, ?date= при переходе с другой
  useEffect(() => {
    if (typeof window === 'undefined') return
    const param = new URLSearchParams(window.location.search).get('date')
    if (param && isDateKey(param)) setSelectedDate(param)
    return subscribeDailyDate(d => setSelectedDate(prev => (prev === d ? prev : d)))
  }, [])

  useEffect(() => {
    if (!storageUserId || typeof window === 'undefined') return
    try {
      sweepLegacyDailyStorage(window.localStorage)
    } catch {
      // ignore storage errors
    }
  }, [storageUserId])

  // Ref для хранения текущих сообщений (избегаем зависимости от chatMessages в useEffect)
  const chatMessagesRef = useRef<ChatMessage[]>([])
  chatMessagesRef.current = chatMessages

  // Ref для предыдущей даты
  const prevDateForChatRef = useRef<string | null>(null)
  
  // Ref чтобы пропустить первое сохранение после смены даты
  const skipNextChatSaveRef = useRef(false)
  const kickoffAttemptedDatesRef = useRef<Set<string>>(new Set())

  // Единый useEffect для загрузки чата при смене даты (из БД)
  useEffect(() => {
    if (!storageUserId) return
    const currentDate = selectedDate
    const currentScope = `${storageUserId}:${currentDate}`
    const prevDate = prevDateForChatRef.current
    
    // Если это та же дата - ничего не делаем
    if (prevDate === currentScope) return
    
    // Устанавливаем флаг чтобы не перезаписать загруженные данные
    skipNextChatSaveRef.current = true

    // Чужая дата не должна ни секунды показывать прежний чат
    chatMessagesRef.current = []
    setChatMessages([])

    // Загружаем чат из БД
    const loadChatHistory = async () => {
      setChatHistoryLoadedDate(null)
      try {
        const data = await fetchJson<{ messages?: Array<{ id?: unknown; role: string; content: string; metadata?: ChatMessage['metadata'] }> }>(
          `/api/daily/chat/messages?date=${currentDate}`,
        )
        const messages = (data.messages || []).map((m) => ({
          id: normalizeChatMessageId(m.id),
          role: m.role as 'user' | 'assistant',
          content: m.content,
          metadata: m.metadata ?? null,
        }))
        setChatMessages(messages)
        setChatHistoryLoadedDate(currentDate)
      } catch {
        // Fallback на localStorage для обратной совместимости
        if (typeof window !== 'undefined') {
          try {
            const chatKey = getChatKey(currentDate)
            const saved = chatKey ? window.localStorage.getItem(chatKey) : null
            const messages = saved ? JSON.parse(saved) : []
            setChatMessages(messages)
            setChatHistoryLoadedDate(currentDate)
          } catch {
            setChatMessages([])
            setChatHistoryLoadedDate(currentDate)
          }
        } else {
          setChatMessages([])
          setChatHistoryLoadedDate(currentDate)
        }
      }
    }
    
    loadChatHistory()
    
    // Обновляем ref
    prevDateForChatRef.current = currentScope
  }, [selectedDate, getChatKey, storageUserId])
  
  // Сообщения теперь сохраняются на сервере через API,
  // localStorage больше не нужен для этого

  // Ref для отслеживания даты при записи черновика (чтобы не записать старые данные под новую дату)
  const draftDateRef = useRef(selectedDate)

  const readPlanDraft = useCallback((date: string): DailyPlanDraft | null => {
    if (!storageUserId) return null
    if (typeof window === 'undefined') return null
    try {
      return readPlanDraftFromStorage(window.localStorage, storageUserId, date)
    } catch {
      return null
    }
  }, [storageUserId])

  const writePlanDraft = useCallback((date: string, draft: DailyPlanDraft) => {
    if (!storageUserId) return
    if (typeof window === 'undefined') return
    try {
      writePlanDraftToStorage(window.localStorage, storageUserId, date, draft)
    } catch {
      // ignore
    }
  }, [storageUserId])

  const clearPlanDraft = useCallback((date: string) => {
    if (!storageUserId) return
    if (typeof window === 'undefined') return
    try {
      clearPlanDraftFromStorage(window.localStorage, storageUserId, date)
    } catch {
      // ignore
    }
  }, [storageUserId])

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

    try {
      // Load daily entry
      const dailyRes = await fetch(`/api/daily?date=${loadingDate}`, { signal })

      // Check if date changed during fetch - prevent race condition
      if (currentDateRef.current !== loadingDate) {
        return
      }

      if (!dailyRes.ok) {
        console.error('Failed to fetch daily entry:', dailyRes.status)
        setDailyEntry(null)
        setPlanText('')
        setTasks([])
        setSelectedTasks(new Set())
        setExtraTasks([])
        setHasUnsavedChanges(false)
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

          setHasUnsavedChanges(shouldUseDraft)

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
          setExtraTasks(parseExtraTasksJson(daily.extraTasksJson))

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
              setSelectedTasks(sanitizeSelectedForTotal(draft!.selectedTaskIds, tasksWithIds.length))
            } else if (daily.selectedTasksJson) {
              const selected = parseSelectedTasksJson(daily.selectedTasksJson)
              const sanitized = sanitizeSelectedForTotal(selected, tasksWithIds.length)
              setSelectedTasks(sanitized)
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
            setHasUnsavedChanges(true)
          } else {
            setHasUnsavedChanges(false)
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
  }, [readPlanDraft, clearPlanDraft])

  useEffect(() => {
    if (!storageUserId) return
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
    setHasUnsavedChanges(false)
    // НЕ сбрасываем chatMessages — они загружаются отдельным useEffect из localStorage
    setCheckPlanResult(null)
    loadData(controller.signal)

    return () => {
      controller.abort()
    }
  }, [selectedDate, storageUserId]) // Intentionally not including loadData to prevent infinite loops

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
  ): Promise<boolean> => {
    const planTextToSave = taskList.map(t => t.taskText).join('\n')

    const allowedIds = new Set(taskList.map(t => t.id))
    const sanitizedSelected = Array.from(selected).filter(id => allowedIds.has(id))

    try {
      const data = await fetchJson<DailyEntry>('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          planText: planTextToSave,
          selectedTasksJson: JSON.stringify(sanitizedSelected),
        }),
      })

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
      if (error instanceof FetchJsonError && error.status === 401) {
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname)
        return false
      }

      console.error('Error saving plan:', error)
      showMessage(`Ошибка при сохранении: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
      return false
    }

    return true
  }, [tasks, selectedTasks, selectedDate, showMessage, clearPlanDraft])

  const buildTasksFromTexts = useCallback((texts: string[]): OpenTask[] => {
    return buildTasksFromTextsForDate(texts, selectedDate)
  }, [selectedDate])

  const remapSelectionByText = useCallback(remapSelectionByTextForTasks, [])

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
      showMessage('Все привычки уже в плане')
      return
    }

    const updatedTexts = [...tasks.map((t) => t.taskText), ...newHabitTexts]
    const updatedTasks = buildTasksFromTexts(updatedTexts)
    const updatedSelected = remapSelectionByText(tasks, selectedTasks, updatedTasks)
    setTasks(updatedTasks)
    setSelectedTasks(updatedSelected)
    setHasUnsavedChanges(true)
    showMessage(`Добавлено ${newHabitTexts.length} ${newHabitTexts.length === 1 ? 'привычка' : 'привычек'}`)
  }, [tasks, selectedTasks, habits, buildTasksFromTexts, remapSelectionByText, showMessage])

  // Создать привычку из задачи
  const createHabitFromTask = useCallback(async (
    taskText: string, 
    frequency: string = 'daily',
    daysOfWeek?: number[]
  ) => {
    try {
      const habit = await fetchJson<Habit>('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskText,
          frequency,
          daysOfWeek,
        }),
      })

      setHabits(prev => [...prev, habit])
      // Убрать из предложений
      setHabitSuggestions(prev => prev.filter(s => s.text !== taskText))
      showMessage('Привычка создана')
    } catch (error) {
      console.error('Error creating habit:', error)
      showMessage(`Ошибка при создании привычки: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
    }
  }, [showMessage])

  const updateHabit = useCallback(async (
    habitId: number,
    updates: { taskText?: string; frequency?: string; daysOfWeek?: number[] }
  ) => {
    try {
      const habit = await fetchJson<Habit>('/api/habits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: habitId,
          ...updates,
        }),
      })

      setHabits(prev => prev.map(item => item.id === habitId ? habit : item))
      showMessage('Привычка обновлена')
    } catch (error) {
      console.error('Error updating habit:', error)
      showMessage(`Ошибка при обновлении привычки: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
    }
  }, [showMessage])

  // Удалить привычку
  const deleteHabit = useCallback(async (habitId: number) => {
    try {
      const res = await fetch(`/api/habits?id=${habitId}`, {
        method: 'DELETE',
      })
      await expectOk(res)

      setHabits(prev => prev.filter(h => h.id !== habitId))
      showMessage('Привычка удалена')
    } catch (error) {
      console.error('Error deleting habit:', error)
      showMessage(`Ошибка при удалении привычки: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
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

  // Перенести задачу на выбранный день
  const postponeTask = useCallback(async (taskId: number, taskText: string, targetDate?: string) => {
    try {
      const tomorrow = format(new Date(new Date(selectedDate).getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
      const transferDate = targetDate || tomorrow
      
      // Отправляем на сервер
      await fetchJson('/api/tasks/process-uncompleted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisions: [{
            taskId,
            taskText,
            action: { type: 'transfer', date: transferDate }
          }],
          sourceDate: selectedDate
        })
      })

      // Удаляем задачу из текущего списка
      const updatedTexts = tasks.filter((t) => t.id !== taskId).map((t) => t.taskText)
      const updatedTasks = buildTasksFromTexts(updatedTexts)
      const updatedSelected = remapSelectionByText(tasks, selectedTasks, updatedTasks)
      setTasks(updatedTasks)
      setSelectedTasks(updatedSelected)
      setHasUnsavedChanges(true)
      showMessage(`Задача перенесена на ${transferDate}`)
    } catch (error) {
      console.error('Error postponing task:', error)
      showMessage(`Ошибка при переносе задачи: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
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
    const updatedSelected = preserveSelectionByTaskIds(selectedTasks, updatedTasks)
    setTasks(updatedTasks)
    setSelectedTasks(updatedSelected)
    setEditingTaskId(null)
    setEditingTaskText('')
    // Отмечаем, что есть несохранённые изменения
    setHasUnsavedChanges(true)
  }, [editingTaskText, tasks, selectedTasks, buildTasksFromTexts])

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
    setHasUnsavedChanges(true)
  }, [draggedTaskId, tasks, selectedTasks, buildTasksFromTexts, remapSelectionByText])

  const savePlan = useCallback(async (): Promise<boolean> => {
    setSaving(true)
    try {
      const saved = await savePlanWithTasks()
      if (saved) {
        setHasUnsavedChanges(false)
        showMessage('План сохранен')
      }
      return saved
    } finally {
      setSaving(false)
    }
  }, [savePlanWithTasks, showMessage])

  // Проверка плана ИИ
  const checkPlan = useCallback(async () => {
    if (tasks.length === 0) {
      showMessage('Добавьте хотя бы одну задачу')
      return
    }

    setCheckingPlan(true)
    setCheckPlanResult(null)
    showMessage('🔍 Проверяю план...', 0)

    try {
      const planTasks = tasks.map(t => t.taskText)

      const result = await fetchJson<CheckPlanResult>('/api/daily/check-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          planTasks,
        }),
      })

      setCheckPlanResult(result)
      setMessage('')
    } catch (error) {
      console.error('Error checking plan:', error)
      showMessage(`Ошибка при проверке плана: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
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

    setSendingChat(true)

    // Дата, к которой принадлежит эта переписка: если пользователь переключит
    // день до конца стрима, обновления не должны утекать на другую дату
    const chatDate = selectedDate
    const isChatDateCurrent = () => currentDateRef.current === chatDate

    const currentMessages = chatMessagesRef.current

    // Добавить сообщение пользователя в историю (если не initialMessage)
    const newUserMessage: ChatMessage = { id: createDailyChatTempMessageId('local-user'), role: 'user', content: messageToSend }
    const updatedMessages = initialMessage 
      ? currentMessages // При initial message не добавляем в UI - это системный запрос
      : [...currentMessages, newUserMessage]
    
    if (!initialMessage) {
      chatMessagesRef.current = updatedMessages
      setChatMessages(updatedMessages)
      clearChatDraft(selectedDate)
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
      const timezone = getBrowserTimezone()

      const res = await fetch('/api/daily/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          currentTime,
          timezone,
          planTasks,
          completedTasks,
          messages: currentMessages,
          userMessage: messageToSend,
        }),
      })

      if (!res.ok) {
        let apiError = `API error: ${res.status}`
        try {
          const errorPayload = await res.json()
          if (typeof errorPayload?.error === 'string') apiError = errorPayload.error
        } catch {
          // Ignore non-JSON error bodies
        }
        throw new Error(apiError)
      }

      const baseMessages = updatedMessages
      const tempAssistantId = createDailyChatTempMessageId('pending')
      const assistantMessage: ChatMessage = { id: tempAssistantId, role: 'assistant', content: '', metadata: null }
      const messagesWithAssistant = [...baseMessages, assistantMessage]
      if (isChatDateCurrent()) {
        chatMessagesRef.current = messagesWithAssistant
        setChatMessages(messagesWithAssistant)
      }

      const updateAssistant = (patch: Partial<ChatMessage>) => {
        // Стрим пережил переключение даты — его сообщения принадлежат chatDate,
        // на экране уже чат другого дня, молча дописываем только в БД (сервер)
        if (!isChatDateCurrent()) return
        const streamedMessages = chatMessagesRef.current.map((message, index) => {
          const isTarget = index === chatMessagesRef.current.length - 1 && message.role === 'assistant'
          return isTarget ? { ...message, ...patch } : message
        })
        chatMessagesRef.current = streamedMessages
        setChatMessages(streamedMessages)
      }

      const streamResult = await consumeDailyChatSseStream(res.body, {
        onText: (_frameText, assistantContent) => {
          updateAssistant({ content: assistantContent })
        },
        onProposal: metadata => {
          updateAssistant({ metadata: metadata as ChatMessage['metadata'] })
        },
        onDone: assistantMessageId => {
          updateAssistant({ id: normalizeChatMessageId(assistantMessageId) })
        },
        onError: error => {
          updateAssistant({ content: `${chatMessagesRef.current.at(-1)?.content ?? ''}\n\nОшибка: ${error}`.trim() })
        },
      })
      void streamResult

      // Карточка расписания в чат не выкладывается: отмашка получена на черновике,
      // поэтому пришедшее со стрима предложение страница применяет к шкале сама.
      // Сигналим только о свежепришедшем proposal текущей даты — предложения из
      // истории (перезагрузка страницы) автоматически не применяются.
      if (isChatDateCurrent()) {
        const lastMessage = chatMessagesRef.current.at(-1)
        if (
          lastMessage?.role === 'assistant'
          && lastMessage.id
          && !isPendingChatMessageId(lastMessage.id)
          && lastMessage.metadata?.type === 'daily_schedule_proposal'
          && !lastMessage.metadata.appliedAt
        ) {
          setPendingAutoApplyScheduleProposalId(lastMessage.id)
        }
      }
      return
    } catch (error) {
      console.error('Error sending chat message:', error)
      if (!(error instanceof DailyChatSseError)) {
        showMessage(`Ошибка при отправке сообщения: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
      }
      return
    } finally {
      setSendingChat(false)
    }
  }, [chatInput, tasks, selectedTasks, selectedDate, showMessage, clearChatDraft])

  const requestPlanChatKickoff = useCallback(async (isSubmittingChat = false, force = false) => {
    if (!shouldKickoffPlanChat({
      selectedDate,
      chatMessages: chatMessagesRef.current,
      loadedDate: chatHistoryLoadedDate,
      sendingChat,
      isSubmittingChat,
      attemptedDates: kickoffAttemptedDatesRef.current,
      force,
    })) return false

    kickoffAttemptedDatesRef.current.add(selectedDate)
    await sendChatMessage(SYSTEM_KICKOFF_PLAN_CHAT)
    return true
  }, [chatHistoryLoadedDate, selectedDate, sendChatMessage, sendingChat])

  const applyPlanTasksFromProposal = useCallback((planTasks: string[]) => {
    setTasks(prevTasks => {
      const nextTasks = buildTasksFromTexts(planTasks)
      setSelectedTasks(prevSelected => mergeAppliedPlanTasks(prevTasks, prevSelected, planTasks, selectedDate).selectedTasks)
      setHasUnsavedChanges(false)
      return nextTasks
    })
  }, [buildTasksFromTexts, selectedDate])

  const canShowPlanChatKickoffCta = shouldShowPlanChatKickoffCta({
    selectedDate,
    chatMessages,
    loadedDate: chatHistoryLoadedDate,
    sendingChat,
    attemptedDates: kickoffAttemptedDatesRef.current,
  })

  const markChatProposalApplied = useCallback((messageId: string, appliedAt: string) => {
    setChatMessages(prev => {
      const next = prev.map(message => {
        if (message.id !== messageId || !message.metadata) return message
        return { ...message, metadata: { ...message.metadata, appliedAt } }
      })
      chatMessagesRef.current = next
      return next
    })
  }, [])

  const clearChat = useCallback(async () => {
    setChatMessages([])
    clearChatDraft(selectedDate)
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
        const chatKey = getChatKey(selectedDate)
        if (chatKey) window.localStorage.removeItem(chatKey)
      } catch {
        // ignore
      }
    }
  }, [selectedDate, getChatKey, clearChatDraft])

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
        const savedEntry = await fetchJson<DailyEntry>('/api/daily', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: selectedDate,
            planText: planTextToSave,
            selectedTasksJson: JSON.stringify(Array.from(selectedTasks)),
          }),
        })

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
      await expectOk(res)

      showMessage('Оценка получена!', 1500)
      setTimeout(() => {
        router.push(`/evaluation/${selectedDate}`)
      }, 1500)
    } catch (error) {
      console.error('Error evaluating:', error)
      showMessage(`Ошибка при получении оценки: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
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
    newTaskText,
    setNewTaskText,
    saving,
    evaluating,
    message,
    showMessage,
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
    markChatProposalApplied,
    requestPlanChatKickoff,
    canShowPlanChatKickoffCta,
    applyPlanTasksFromProposal,
    pendingAutoApplyScheduleProposalId,
    clearPendingAutoApplyScheduleProposal: () => setPendingAutoApplyScheduleProposalId(null),
    addTask,
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
    updateHabit,
    deleteHabit,
  }
}
