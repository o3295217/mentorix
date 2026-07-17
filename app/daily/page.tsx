'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { useDaily } from '@/hooks/useDaily'
import { useDailySchedule } from '@/hooks/daily/useDailySchedule'
import DayTimeline from '@/components/daily/DayTimeline'
import DailyScheduleProposalCard from '@/components/daily/DailyScheduleProposalCard'
import DatePickerWithIndicators from '@/components/DatePickerWithIndicators'
import { CheckIcon, CloseIcon, TaskDeleteIcon, TaskPostponeIcon, TaskRepeatIcon } from '@/components/icons'
import UncompletedTasksModal, { TaskDecision, UncompletedTask } from '@/components/UncompletedTasksModal'
import { areTasksSimilar } from '@/lib/task-match'
import { FetchJsonError, fetchJson, getFetchErrorMessage } from '@/lib/fetch-json'
import type { DailySchedule, DailyScheduleLoadSummary } from '@/lib/daily-schedule'
import { isPendingChatMessageId } from '@/hooks/daily/chat-helpers'
import { sendDailyChatWithPreconditions } from '@/hooks/daily/chat-submit-helpers'
import { buildApplyProposalRequestBody, buildProposalApplyOptions, applyDailyScheduleProposal, type ProposalApplyOptions } from '@/hooks/daily/proposal-helpers'
import { selectStrictScheduleConfirmationProposal } from '@/hooks/daily/schedule-confirmation-helpers'

type FrequencyType = 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'custom'
type TaskActionType = 'delete' | 'postpone' | 'habit-create' | 'habit-remove'
type FactItem = { id: number; text: string; type: string; category: string | null }

const taskActionButtonBase = 'flex h-8 w-8 items-center justify-center rounded-md border transition-colors'
const confirmButtonBase = 'flex h-7 w-7 items-center justify-center rounded-md text-sm leading-none transition-colors'

function getLocalTimeHHMM(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function getNextDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + 1)
  return format(date, 'yyyy-MM-dd')
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`)
}

function getWorkNoun(count: number) {
  const lastTwoDigits = count % 100
  const lastDigit = count % 10
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'дел'
  if (lastDigit === 1) return 'дело'
  if (lastDigit >= 2 && lastDigit <= 4) return 'дела'
  return 'дел'
}

type FactsResponse = {
  items: FactItem[]
  stats: { total: number }
}

type ApplyProposalResponse = {
  schedule: DailySchedule | null
  updatedAt: string | null
  status?: string
  loadSummary?: DailyScheduleLoadSummary | null
}

export default function DailyPage() {
  const router = useRouter()
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null)
  const newTaskTextareaRef = useRef<HTMLTextAreaElement>(null)
  const activeTaskActionRowRef = useRef<HTMLDivElement | null>(null)
  const habitEditorRef = useRef<HTMLDivElement | null>(null)
  const tasksContainerRef = useRef<HTMLDivElement | null>(null)
  const [mounted, setMounted] = useState(false)
  const [currentTime, setCurrentTime] = useState<string | null>(null)
  const [showUncompletedModal, setShowUncompletedModal] = useState(false)
  const [uncompletedTasks, setUncompletedTasks] = useState<UncompletedTask[]>([])
  const [applyingProposalId, setApplyingProposalId] = useState<string | null>(null)
  const [dismissedProposalIds, setDismissedProposalIds] = useState<Set<string>>(() => new Set())
  const [isSubmittingChat, setIsSubmittingChat] = useState(false)
  const isSubmittingChatRef = useRef(false)
  const timelineMutationLocked = applyingProposalId !== null || isSubmittingChat

  const [habitFrequency, setHabitFrequency] = useState<FrequencyType>('daily')
  const [habitDays, setHabitDays] = useState<number[]>([])
  const [editingHabitId, setEditingHabitId] = useState<number | null>(null)
  const [editingHabitText, setEditingHabitText] = useState('')
  const [editingHabitFrequency, setEditingHabitFrequency] = useState<FrequencyType>('daily')
  const [editingHabitDays, setEditingHabitDays] = useState<number[]>([])
  
  // Локальное состояние action-кнопок строки задачи
  const [activeTaskAction, setActiveTaskAction] = useState<{ taskId: number; type: TaskActionType } | null>(null)
  const [postponeTargetDate, setPostponeTargetDate] = useState('')
  
  // Inline-подтверждение удаления extra tasks
  const [confirmExtraDelete, setConfirmExtraDelete] = useState<number | null>(null)
  
  // Сворачивание выполненных задач
  const [showCompleted, setShowCompleted] = useState(false)
  const [showHabitsExpanded, setShowHabitsExpanded] = useState(false)
  
  // Отклонённые предложения привычек - загружаем из localStorage
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const saved = localStorage.getItem('dismissedHabitSuggestions')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })

  // Виджет «Сделано на этой неделе»
  const [weekFacts, setWeekFacts] = useState<FactItem[]>([])
  const [weekFactsTotal, setWeekFactsTotal] = useState(0)
  const [showWeekFacts, setShowWeekFacts] = useState(false)
  // Виджет «Сделано за месяц»
  const [monthFacts, setMonthFacts] = useState<FactItem[]>([])
  const [monthFactsTotal, setMonthFactsTotal] = useState(0)
  const [showMonthFacts, setShowMonthFacts] = useState(false)
  
  // Сохраняем отклонённые предложения в localStorage
  useEffect(() => {
    if (dismissedSuggestions.size > 0) {
      localStorage.setItem('dismissedHabitSuggestions', JSON.stringify([...dismissedSuggestions]))
    }
  }, [dismissedSuggestions])

  // Автоскролл полотна задач к низу при раскрытии блока «Выполнено»
  useEffect(() => {
    if (!showCompleted) return
    const container = tasksContainerRef.current
    if (!container) return
    const animate = (from: number, to: number, duration: number) => {
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 3)
        container.scrollTop = from + (to - from) * eased
        if (t < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
    const tick = () => {
      const target = container.scrollHeight - container.clientHeight
      animate(container.scrollTop, target, 320)
    }
    // Даём layout обновиться после раскрытия нижнего блока.
    const id = window.setTimeout(tick, 230)
    return () => window.clearTimeout(id)
  }, [showCompleted])

  useEffect(() => {
    if (!activeTaskAction) return

    const handleMouseDown = (event: MouseEvent) => {
      if (!activeTaskActionRowRef.current) return
      if (!activeTaskActionRowRef.current.contains(event.target as Node)) {
        setActiveTaskAction(null)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveTaskAction(null)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeTaskAction])

  useEffect(() => {
    if (editingHabitId === null) return

    const handleMouseDown = (event: MouseEvent) => {
      if (!habitEditorRef.current) return
      if (!habitEditorRef.current.contains(event.target as Node)) {
        setEditingHabitId(null)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEditingHabitId(null)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editingHabitId])

  useEffect(() => {
    if (!showHabitsExpanded) {
      setEditingHabitId(null)
    }
  }, [showHabitsExpanded])
  
  const {
    selectedDate,
    setSelectedDate,
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
    chatMessages,
    chatInput,
    setChatInput,
    sendChatMessage,
    sendingChat,
    clearChat,
    markChatProposalApplied,
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
    showMessage,
    // Habits
    habits,
    habitSuggestions,
    addHabitsToTasks,
    createHabitFromTask,
    updateHabit,
    deleteHabit,
  } = useDaily()

  const hasStreamingAssistantResponse = sendingChat
    && chatMessages.some((msg, index) => (
      index === chatMessages.length - 1
      && msg.role === 'assistant'
      && msg.content.trim().length > 0
    ))

  // Refs для timeline-хука: нужно актуальное состояние внутри async-колбэков.
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges)
  hasUnsavedChangesRef.current = hasUnsavedChanges
  const dailyEntryRef = useRef(dailyEntry)
  dailyEntryRef.current = dailyEntry
  const savePlanRef = useRef(savePlan)
  savePlanRef.current = savePlan

  // Таймзона браузера (для записи в DailySchedule.timezone при auto-layout).
  const scheduleTimezone = useMemo(() => {
    if (typeof window === 'undefined') return 'UTC'
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch {
      return 'UTC'
    }
  }, [])

  // Сохранить план существующим способом перед входом в режим расписания.
  const ensureEntrySaved = useCallback(async () => {
    if (dailyEntryRef.current?.id && !hasUnsavedChangesRef.current) return true
    return savePlanRef.current()
  }, [])

  const {
    mode: scheduleMode,
    isEntering: scheduleEntering,
    isExiting: scheduleExiting,
    enterTimeline,
    exitTimeline,
    schedule,
    unscheduledTaskIndexes,
    isLoading: scheduleLoading,
    isSaving: scheduleSaving,
    error: scheduleError,
    isDirty: scheduleDirty,
    setBlockRange,
    moveBlockByStep,
    removeBlock,
    scheduleUnscheduledTask,
    applySavedSchedule,
    flushScheduleChanges,
    appliedAnimationKey,
  } = useDailySchedule({
    selectedDate,
    tasks,
    timezone: scheduleTimezone,
    ensureEntrySaved,
    showMessage,
    mutationLocked: timelineMutationLocked,
  })

  const handleEnterTimeline = useCallback(() => {
    void enterTimeline()
  }, [enterTimeline])

  const handleExitTimeline = useCallback(() => {
    void exitTimeline()
  }, [exitTimeline])

  const handleApplyProposal = useCallback(async (
    messageId: string | undefined,
    metadata: NonNullable<(typeof chatMessages)[number]['metadata']>,
    options: ProposalApplyOptions,
  ) => {
    if (!messageId || applyingProposalId) return
    const requestBody = buildApplyProposalRequestBody({
      date: selectedDate,
      messageId,
      options,
      expectedCurrentScheduleHash: metadata.currentScheduleHash,
    })
    if (requestBody === null) {
      throw new Error('Не удалось применить расписание: ответ ассистента ещё не сохранён. Попробуйте обновить чат.')
    }
    const requestDate = selectedDate
    setApplyingProposalId(messageId)
    try {
      await applyDailyScheduleProposal({
        ensureEntrySaved,
        flushScheduleChanges,
        applyProposalRequest: () => fetchJson<ApplyProposalResponse>('/api/daily/schedule/apply-proposal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }),
        applySavedSchedule,
        expectedDate: requestDate,
        markChatProposalApplied: appliedAt => markChatProposalApplied(messageId, appliedAt),
      })
    } catch (error) {
      if (error instanceof FetchJsonError && error.status === 409) {
        throw new Error('Расписание уже изменилось. Обновите чат или попросите ассистента собрать новый вариант.')
      }
      throw new Error(getFetchErrorMessage(error, 'не удалось применить расписание'))
    } finally {
      setApplyingProposalId(null)
    }
  }, [applyingProposalId, applySavedSchedule, ensureEntrySaved, flushScheduleChanges, markChatProposalApplied, selectedDate])

  const handleSendChatMessage = useCallback(async (initialMessage?: string) => {
    if (isSubmittingChatRef.current || sendingChat) return
    const messageText = initialMessage ?? chatInput
    const strictProposal = selectStrictScheduleConfirmationProposal(messageText, chatMessages, dismissedProposalIds)
    isSubmittingChatRef.current = true
    setIsSubmittingChat(true)
    try {
      if (strictProposal) {
        await handleApplyProposal(strictProposal.messageId, strictProposal.metadata, buildProposalApplyOptions(strictProposal.metadata))
        setChatInput('')
        showMessage('Расписание применено')
        return
      }
      await sendDailyChatWithPreconditions({
        ensureEntrySaved,
        flushScheduleChanges,
        sendChatMessage,
        showMessage,
        initialMessage,
      })
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Не удалось применить расписание')
    } finally {
      isSubmittingChatRef.current = false
      setIsSubmittingChat(false)
    }
  }, [chatInput, chatMessages, dismissedProposalIds, ensureEntrySaved, flushScheduleChanges, handleApplyProposal, sendChatMessage, sendingChat, setChatInput, showMessage])

  const handleDismissProposal = useCallback((id: string | undefined) => {
    if (!id) return
    setDismissedProposalIds(prev => new Set(prev).add(id))
  }, [])

  // Список текстов выполненных задач для проверки целей
  const completedTaskTexts = useMemo(() => {
    return tasks
      .filter(t => selectedTasks.has(t.id))
      .map(t => t.taskText)
  }, [tasks, selectedTasks])

  // Проверка, выполнена ли цель (fuzzy-match с выполненными задачами)
  const isGoalCompleted = useCallback((goalText: string): boolean => {
    return completedTaskTexts.some(taskText => areTasksSimilar(goalText, taskText))
  }, [completedTaskTexts])

  useEffect(() => {
    const textarea = newTaskTextareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [newTaskText])

  const resizeChatTextarea = useCallback((textarea: HTMLTextAreaElement, value: string) => {
    if (value === '') {
      textarea.style.height = '42px'
      return
    }

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
  }, [])

  const handleDiscussProposal = useCallback((text: string) => {
    setChatInput(text)
    window.requestAnimationFrame(() => {
      const textarea = chatTextareaRef.current
      if (!textarea) return
      resizeChatTextarea(textarea, text)
      textarea.focus()
    })
  }, [resizeChatTextarea, setChatInput])

  useLayoutEffect(() => {
    const textarea = chatTextareaRef.current
    if (!textarea) return

    resizeChatTextarea(textarea, chatInput)
  }, [chatInput, resizeChatTextarea])

  // Заголовок для блока целей недели с датами
  const weekLabel = useMemo(() => {
    const date = parseDateKey(selectedDate)
    const weekStart = startOfWeek(date, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 })
    const startDay = format(weekStart, 'd', { locale: ru })
    const endDay = format(weekEnd, 'd', { locale: ru })
    const month = format(weekEnd, 'MMM', { locale: ru }).replace('.', '')
    return `План на неделю ${startDay}-${endDay} ${month}`
  }, [selectedDate])

  // Заголовок для блока целей месяца
  const monthLabel = useMemo(() => {
    const date = parseDateKey(selectedDate)
    const monthName = format(date, 'LLLL', { locale: ru })
    // Первая буква заглавная
    return `План на ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`
  }, [selectedDate])

  // Проверить, является ли задача привычкой
  const getHabitForTask = (taskText: string) => {
    return habits.find(h => h.taskText.toLowerCase() === taskText.toLowerCase())
  }

  const normalizeHabitFrequency = (frequency: string): FrequencyType => {
    if (
      frequency === 'daily' ||
      frequency === 'weekdays' ||
      frequency === 'weekends' ||
      frequency === 'weekly' ||
      frequency === 'custom'
    ) {
      return frequency
    }

    return 'daily'
  }

  const parseHabitDays = (daysOfWeek: string | null): number[] => {
    if (!daysOfWeek) return []

    try {
      const parsed = JSON.parse(daysOfWeek)
      if (!Array.isArray(parsed)) return []

      return parsed
        .filter((day): day is number => Number.isInteger(day) && day >= 1 && day <= 7)
        .sort((left, right) => left - right)
    } catch {
      return []
    }
  }

  const closeTaskAction = useCallback(() => {
    setActiveTaskAction(null)
  }, [])

  const closeHabitEditor = useCallback(() => {
    setEditingHabitId(null)
  }, [])

  const toggleTaskAction = useCallback((taskId: number, type: TaskActionType) => {
    setEditingHabitId(null)
    setActiveTaskAction((prev) => {
      if (prev?.taskId === taskId && prev.type === type) {
        return null
      }
      return { taskId, type }
    })

    if (type === 'habit-create') {
      setHabitFrequency('daily')
      setHabitDays([])
    } else if (type === 'postpone') {
      setPostponeTargetDate(getNextDateKey(selectedDate))
    }
  }, [selectedDate])

  // Создать привычку с выбранными параметрами
  const handleCreateHabit = async (taskText: string) => {
    await createHabitFromTask(
      taskText,
      habitFrequency, 
      habitFrequency === 'weekly' || habitFrequency === 'custom' ? habitDays : undefined
    )
    setActiveTaskAction(null)
  }

  // Переключить день недели
  const toggleDay = (day: number) => {
    setHabitDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  const toggleEditingHabitDay = (day: number) => {
    setEditingHabitDays(prev =>
      prev.includes(day) ? prev.filter(item => item !== day) : [...prev, day].sort()
    )
  }

  const startEditingHabit = useCallback((habitId: number) => {
    if (editingHabitId === habitId) {
      closeHabitEditor()
      return
    }

    const habit = habits.find(item => item.id === habitId)
    if (!habit) return

    setActiveTaskAction(null)
    setEditingHabitId(habit.id)
    setEditingHabitText(habit.taskText)
    setEditingHabitFrequency(normalizeHabitFrequency(habit.frequency))
    setEditingHabitDays(parseHabitDays(habit.daysOfWeek))
  }, [closeHabitEditor, editingHabitId, habits])

  const handleSaveHabit = useCallback(async () => {
    if (editingHabitId === null) return

    const nextTaskText = editingHabitText.trim()
    if (!nextTaskText) {
      showMessage('Название привычки не может быть пустым')
      return
    }

    await updateHabit(editingHabitId, {
      taskText: nextTaskText,
      frequency: editingHabitFrequency,
      daysOfWeek: editingHabitFrequency === 'weekly' || editingHabitFrequency === 'custom'
        ? editingHabitDays
        : [],
    })

    setEditingHabitId(null)
  }, [editingHabitDays, editingHabitFrequency, editingHabitId, editingHabitText, showMessage, updateHabit])

  const handleDeleteHabitFromEditor = useCallback(async () => {
    if (editingHabitId === null) return

    const habit = habits.find(item => item.id === editingHabitId)
    if (!habit) return

    if (!confirm(`Удалить привычку "${habit.taskText}"?`)) {
      return
    }

    await deleteHabit(editingHabitId)
    setEditingHabitId(null)
  }, [deleteHabit, editingHabitId, habits])

  // Проверка невыполненных задач перед оценкой
  const handleEvaluateClick = () => {
    // Для повторной оценки не поднимаем модалку снова: решение по невыполненным
    // задачам уже было принято при первой оценке этого дня.
    if (dailyEntry?.evaluation) {
      evaluate(router)
      return
    }

    // Найти невыполненные задачи: есть в плане (tasks), но не отмечены (не в selectedTasks)
    const uncompleted = tasks.filter(t => !selectedTasks.has(t.id))
    
    if (uncompleted.length > 0) {
      // Есть невыполненные — показываем модалку
      setUncompletedTasks(uncompleted.map(t => ({
        id: t.id,
        taskText: t.taskText,
        transferCount: undefined // TODO: можно добавить отслеживание
      })))
      setShowUncompletedModal(true)
    } else {
      // Все задачи выполнены — сразу оцениваем
      evaluate(router)
    }
  }

  // Обработка решений по невыполненным задачам
  const handleUncompletedDecisions = async (decisions: TaskDecision[]) => {
    setShowUncompletedModal(false)
    
    // Отправляем решения на сервер
    try {
      await fetchJson('/api/tasks/process-uncompleted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisions,
          sourceDate: selectedDate
        })
      })
    } catch (error) {
      console.error('Error processing uncompleted tasks:', error)
      showMessage(`Не удалось обработать невыполненные задачи: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
      return
    }
    
    // Продолжаем оценку
    evaluate(router)
  }

  // Прокрутка чата вниз при новых сообщениях
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages])

  // Статистика выполнения
  const activeTasks = tasks.filter(t => !selectedTasks.has(t.id))
  const completedTasks = tasks.filter(t => selectedTasks.has(t.id))
  const completedCount = completedTasks.length
  const totalCount = tasks.length
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const extraDoneCount = extraTasks.length
  const hasEvaluation = !!dailyEntry?.evaluation
  const planChangedAfterEval = hasEvaluation && dailyEntry?.updatedAt && dailyEntry.evaluation?.createdAt
    && new Date(dailyEntry.updatedAt) > new Date(dailyEntry.evaluation.createdAt)

  const normalizePlanLine = (value: string) => {
    let s = (value || '')
      .normalize('NFKC')
      .replace(/\u00A0/g, ' ') // nbsp
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width
      .trim()

    // Common leading markers: bullets, dashes, checkbox-like, emojis.
    s = s.replace(/^(?:\*|•|-|—|–|\d+[.)])\s+/, '')
    s = s.replace(/^(?:\[\s*\]|\[x\]|\[X\]|☐|☑|✅|✔️|✔)\s+/, '')

    // Canonicalize Russian yo.
    s = s.replace(/ё/g, 'е').replace(/Ё/g, 'Е')

    // Collapse whitespace.
    s = s.replace(/\s+/g, ' ').trim()

    // Drop trailing punctuation that often differs.
    s = s.replace(/[\s,.;:!]+$/g, '').trim()

    return s.toLowerCase()
  }

  const savedFlags = (() => {
    const savedLines = (dailyEntry?.planText || '')
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    const counts = new Map<string, number>()
    for (const line of savedLines) {
      const key = normalizePlanLine(line)
      if (!key) continue
      counts.set(key, (counts.get(key) || 0) + 1)
    }

    return tasks.map((task) => {
      const key = normalizePlanLine(task.taskText)
      if (!key) return false
      const c = counts.get(key) || 0
      if (c <= 0) return false
      if (c === 1) counts.delete(key)
      else counts.set(key, c - 1)
      return true
    })
  })()

  // Отмечаем, что компонент смонтирован на клиенте
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let timeoutId: number | undefined

    const updateClock = () => {
      const now = new Date()
      setCurrentTime(getLocalTimeHHMM(now))

      const millisecondsToNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds())
      timeoutId = window.setTimeout(updateClock, Math.min(millisecondsToNextMinute + 50, 60000))
    }

    updateClock()

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  // Загрузка фактов недели и месяца относительно выбранной даты
  useEffect(() => {
    (async () => {
      try {
        const selected = parseDateKey(selectedDate)
        const weekStart = startOfWeek(selected, { weekStartsOn: 1 })
        const weekEnd = endOfWeek(selected, { weekStartsOn: 1 })
        const monthStart = startOfMonth(selected)
        const monthEnd = endOfMonth(selected)

        const [weekResult, monthResult] = await Promise.allSettled([
          fetchJson<FactsResponse>(`/api/facts?from=${format(weekStart, 'yyyy-MM-dd')}&to=${format(weekEnd, 'yyyy-MM-dd')}&limit=200`),
          fetchJson<FactsResponse>(`/api/facts?from=${format(monthStart, 'yyyy-MM-dd')}&to=${format(monthEnd, 'yyyy-MM-dd')}&limit=500`),
        ])

        if (weekResult.status === 'fulfilled') {
          // Неделя — без привычек (фильтр по category, т.к. type всегда 'task')
          const withoutHabits = weekResult.value.items.filter((i) => i.category !== 'привычки')
          setWeekFacts(withoutHabits)
          setWeekFactsTotal(withoutHabits.length)
        } else {
          console.error('Error loading week facts:', weekResult.reason)
          setWeekFacts([])
          setWeekFactsTotal(0)
        }

        if (monthResult.status === 'fulfilled') {
          // Месяц — без привычек (фильтр по category, т.к. type всегда 'task')
          const withoutHabits = monthResult.value.items.filter((i) => i.category !== 'привычки')
          setMonthFacts(withoutHabits)
          setMonthFactsTotal(withoutHabits.length)
        } else {
          console.error('Error loading month facts:', monthResult.reason)
          setMonthFacts([])
          setMonthFactsTotal(0)
        }
      } catch (error) {
        console.error('Error loading facts:', error)
      }
    })()
  }, [selectedDate])

  const showSavePlanAttention = hasUnsavedChanges && !saving

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Ежедневное планирование</h1>
        <DatePickerWithIndicators value={selectedDate} onChange={setSelectedDate} />
      </div>

      <p className="text-lg text-gray-400">
        {mounted ? format(parseDateKey(selectedDate), 'd MMMM yyyy, EEEE', { locale: ru }) : '\u00A0'}
      </p>

      {/* Context from periods */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <h3 className="font-semibold text-lg text-blue-200 mb-3">{weekLabel}:</h3>
          {weekGoals.length > 0 ? (
            <ul className="text-base text-blue-300 space-y-1.5">
              {weekGoals.map((goal, index) => {
                // Используем статус из API (за весь период) или проверяем задачи текущего дня
                const goalText = typeof goal === 'string' ? goal : goal.text
                const completedInPeriod = typeof goal === 'string' ? false : goal.completed
                const completedToday = isGoalCompleted(goalText)
                const completed = completedInPeriod || completedToday
                return (
                  <li key={index} className="flex items-center gap-2 leading-normal">
                    <span className={completed ? 'text-green-400' : 'text-gray-500'}>
                      {completed ? '✓' : '•'}
                    </span>
                    <span className={`flex-1 ${completed ? 'text-green-400' : ''}`}>
                      {goalText}
                    </span>
                    {!completed && (
                      <button
                        onClick={() => addGoalToTasks(goalText)}
                        className="text-blue-400 hover:text-blue-200 text-lg leading-none px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/20 rounded-md whitespace-nowrap font-medium"
                        title="Добавить в план дня"
                        aria-label="Добавить в план дня"
                      >
                        →
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-base text-blue-400">Не установлены</p>
          )}
        </div>

        <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <h3 className="font-semibold text-lg text-purple-200 mb-3">{monthLabel}:</h3>
          {monthGoals.length > 0 ? (
            <ul className="text-base text-purple-300 space-y-1.5">
              {monthGoals.map((goal, index) => {
                // Используем статус из API (за весь период) или проверяем задачи текущего дня
                const goalText = typeof goal === 'string' ? goal : goal.text
                const completedInPeriod = typeof goal === 'string' ? false : goal.completed
                const completedToday = isGoalCompleted(goalText)
                const completed = completedInPeriod || completedToday
                return (
                  <li key={index} className="flex items-center gap-2 leading-normal">
                    <span className={completed ? 'text-green-400' : 'text-gray-500'}>
                      {completed ? '✓' : '•'}
                    </span>
                    <span className={`flex-1 ${completed ? 'text-green-400' : ''}`}>
                      {goalText}
                    </span>
                    {!completed && (
                      <button
                        onClick={() => addGoalToTasks(goalText)}
                        className="text-purple-400 hover:text-purple-200 text-lg leading-none px-3 py-1.5 bg-purple-500/15 hover:bg-purple-500/20 rounded-md whitespace-nowrap font-medium"
                        title="Добавить в план дня"
                        aria-label="Добавить в план дня"
                      >
                        →
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-base text-purple-400">Не установлены</p>
          )}
        </div>
      </div>

      {/* Виджеты «Сделано за неделю» и «Сделано за месяц» */}
      {(weekFactsTotal > 0 || monthFactsTotal > 0) && (
        <div className={`grid grid-cols-1 ${weekFactsTotal > 0 && monthFactsTotal > 0 ? 'md:grid-cols-2' : ''} gap-4`}>
          {/* Сделано за неделю */}
          {weekFactsTotal > 0 && (
          <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-4">
            <button
              onClick={() => setShowWeekFacts(!showWeekFacts)}
              className="w-full flex items-center justify-between"
            >
              <h3 className="text-sm font-medium text-blue-300">
                Сделано за неделю: {weekFactsTotal} {getWorkNoun(weekFactsTotal)}
              </h3>
              <span className="text-blue-400 text-xs">{showWeekFacts ? '▲ скрыть' : '▼ показать'}</span>
            </button>
            {showWeekFacts && (
              <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                {weekFacts.map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <span className="text-blue-500">✓</span>
                    <span className="text-gray-300">{item.text}</span>
                    {item.category && (
                      <span className={`text-[10px] ml-auto ${
                        item.category === 'стратегические' ? 'text-orange-400' :
                        item.category === 'операционные' ? 'text-blue-400' : 'text-gray-500'
                      }`}>{item.category}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Сделано за месяц */}
          {monthFactsTotal > 0 && (
          <div className="rounded-xl bg-purple-500/5 border border-purple-500/20 p-4">
            <button
              onClick={() => setShowMonthFacts(!showMonthFacts)}
              className="w-full flex items-center justify-between"
            >
              <h3 className="text-sm font-medium text-purple-300">
                Сделано за месяц: {monthFactsTotal} {getWorkNoun(monthFactsTotal)}
              </h3>
              <span className="text-purple-400 text-xs">{showMonthFacts ? '▲ скрыть' : '▼ показать'}</span>
            </button>
            {showMonthFacts && (
              <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                {monthFacts.map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <span className="text-purple-500">✓</span>
                    <span className="text-gray-300">{item.text}</span>
                    {item.category && (
                      <span className={`text-[10px] ml-auto ${
                        item.category === 'стратегические' ? 'text-orange-400' :
                        item.category === 'операционные' ? 'text-blue-400' : 'text-gray-500'
                      }`}>{item.category}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {/* Plan and Chat side by side - 60/40 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Plan - Left (60%) */}
        <div className="lg:col-span-3 card flex flex-col !pr-0" style={{ minHeight: '500px', maxHeight: '80vh' }}>
          <div className="mb-4 flex flex-shrink-0 flex-wrap items-start justify-between gap-3 pr-6 sm:items-center">
            <div className="flex flex-shrink-0 items-baseline gap-2 whitespace-nowrap">
              <h2 className="text-xl font-bold">План на день</h2>
              <span
                className="inline-block text-xl font-semibold tabular-nums leading-none tracking-tight text-gray-400"
                aria-label={currentTime ? `Текущее локальное время: ${currentTime}` : 'Текущее локальное время загружается'}
                title={currentTime ? `Текущее локальное время: ${currentTime}` : 'Текущее локальное время загружается'}
              >
                <span className={currentTime ? undefined : 'text-transparent'} suppressHydrationWarning>
                  {currentTime ?? '00:00'}
                </span>
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 sm:justify-end">
              {scheduleMode === 'list' && totalCount > 0 && (
                <span className={`whitespace-nowrap text-base font-semibold tabular-nums leading-none tracking-tight ${
                  completionPercent === 100 ? 'text-green-400' :
                  completionPercent > 0 ? 'text-amber-400' :
                  'text-gray-400'
                }`}>
                  {completedCount}/{totalCount} ({completionPercent}%)
                  {extraDoneCount > 0 && ` +${extraDoneCount}`}
                </span>
              )}
              {scheduleMode === 'list' && totalCount > 0 && (
                <span className="text-base leading-none text-gray-600" aria-hidden="true">·</span>
              )}
              {scheduleMode === 'list' && (
                <button
                  type="button"
                  onClick={handleEnterTimeline}
                  disabled={tasks.length === 0 || scheduleEntering || scheduleLoading}
                  title={
                    tasks.length === 0
                      ? 'Добавьте хотя бы одну задачу в план, чтобы расписать день по времени'
                      : 'Разместить задачи на временной шкале 06:00–24:00'
                  }
                  className="whitespace-nowrap text-base font-semibold leading-none text-primary-300 transition-colors hover:text-primary-200 focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-primary-300"
                >
                  {scheduleEntering || scheduleLoading ? 'Открываю…' : 'Расписать по времени'}
                </button>
              )}
              {scheduleMode === 'timeline' && (
                <button
                  type="button"
                  onClick={handleExitTimeline}
                  disabled={scheduleExiting}
                  className="whitespace-nowrap text-base font-semibold leading-none text-primary-300 transition-colors hover:text-primary-200 focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-primary-300"
                >
                  {scheduleExiting ? 'Сохраняю…' : '← Назад к списку'}
                </button>
              )}
            </div>
          </div>

          {/* Добавление новой задачи */}
          {scheduleMode === 'list' ? (
            <>
          <div className="mb-4 flex gap-2 items-start flex-shrink-0 pr-6">
            <textarea
              ref={newTaskTextareaRef}
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  addTask()
                }
              }}
              placeholder="Добавить задачу..."
              rows={1}
              className="flex-1 px-3 py-2 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-800 text-gray-100 placeholder-gray-400 resize-none overflow-hidden"
              style={{ minHeight: '42px', height: 'auto' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = target.scrollHeight + 'px'
              }}
            />
            <button
              onClick={addTask}
              className="btn-primary"
            >
              Добавить
            </button>
          </div>

          {/* Блок привычек — всегда показываем если есть привычки */}
          {habits.length > 0 && (() => {
            const taskTextsLower = new Set(tasks.map(t => t.taskText.toLowerCase()))
            const habitsNotInPlan = habits.filter(h => !taskTextsLower.has(h.taskText.toLowerCase()))

            return (
              <div className={`relative z-40 mb-4 mr-6 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 ${showHabitsExpanded ? 'shadow-[0_12px_32px_rgba(0,0,0,0.28)]' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-amber-300 font-medium">
                    Привычки ({habits.length})
                  </span>
                  <div className="flex-1 flex gap-1 overflow-hidden">
                    {habits.slice(0, 3).map((habit) => {
                      const isInPlan = taskTextsLower.has(habit.taskText.toLowerCase())
                      return (
                        <span
                          key={habit.id}
                          className={`text-xs px-2 py-0.5 rounded-full truncate max-w-[120px] ${
                            isInPlan
                              ? 'bg-green-500/15 text-green-400'
                              : 'bg-amber-500/15 text-amber-400'
                          }`}
                        >
                          {isInPlan && ' '}{habit.taskText}
                        </span>
                      )
                    })}
                    {habits.length > 3 && (
                      <span className="text-xs text-amber-500">+{habits.length - 3}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHabitsExpanded((prev) => !prev)}
                    className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors"
                    title={showHabitsExpanded ? 'Свернуть привычки' : 'Развернуть привычки'}
                    aria-label={showHabitsExpanded ? 'Свернуть привычки' : 'Развернуть привычки'}
                    aria-expanded={showHabitsExpanded}
                  >
                    {showHabitsExpanded ? '▴' : '▾'}
                  </button>
                </div>

                {showHabitsExpanded && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 shadow-2xl ring-1 ring-amber-500/10 backdrop-blur-md">
                  <div className="flex items-start gap-2">
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {habits.map((habit) => {
                        const isInPlan = taskTextsLower.has(habit.taskText.toLowerCase())
                        return (
                          <div
                            key={habit.id}
                            className={`inline-flex items-center gap-1 text-xs pl-2 pr-1 py-1 rounded-full ${
                              isInPlan
                                ? 'bg-green-500/15 text-green-400'
                                : 'bg-amber-500/15 text-amber-300'
                            }`}
                          >
                            <button
                              onClick={() => !isInPlan && addHabitsToTasks([habit.taskText])}
                              className={isInPlan ? 'cursor-default line-through opacity-60' : 'hover:text-amber-900 transition-colors'}
                              title={isInPlan ? 'Уже в плане' : 'Добавить в план'}
                              disabled={isInPlan}
                            >
                              {isInPlan && ' '}
                              {habit.taskText}
                              {habit.streak > 0 && <span className={`ml-1 ${isInPlan ? 'text-green-500' : 'text-amber-600'}`}>{habit.streak}</span>}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                startEditingHabit(habit.id)
                              }}
                              className={`ml-1 w-5 h-5 flex items-center justify-center rounded transition-colors ${
                                editingHabitId === habit.id
                                  ? 'bg-amber-500 text-white'
                                  : 'text-amber-400 hover:bg-amber-500/15 hover:text-amber-200'
                              }`}
                              title="Редактировать привычку"
                              aria-pressed={editingHabitId === habit.id}
                            >
                              ✎
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    {habitsNotInPlan.length > 0 && (
                      <button
                        onClick={() => addHabitsToTasks()}
                        className="h-8 flex-shrink-0 rounded-md bg-amber-600/80 px-2.5 text-xs text-white transition-colors hover:bg-amber-600"
                      >
                        + Все в план
                      </button>
                    )}
                  </div>

                  {editingHabitId !== null && (
                    <div
                      ref={habitEditorRef}
                      className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3"
                    >
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editingHabitText}
                          onChange={(e) => setEditingHabitText(e.target.value)}
                          className="w-full rounded-lg border border-amber-500/20 bg-gray-900/70 px-3 py-2 text-sm text-amber-50 outline-none transition-colors focus:border-amber-400"
                          placeholder="Название привычки"
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-amber-200">Повтор:</span>
                          {[
                            { value: 'daily', label: 'Ежедневно' },
                            { value: 'weekdays', label: 'Будни' },
                            { value: 'weekends', label: 'Выходные' },
                            { value: 'weekly', label: 'Раз в неделю' },
                            { value: 'custom', label: 'Свои дни' },
                          ].map(option => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setEditingHabitFrequency(option.value as FrequencyType)}
                              className={`px-2 py-1 rounded-md text-xs transition-colors ${
                                editingHabitFrequency === option.value
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>

                        {(editingHabitFrequency === 'weekly' || editingHabitFrequency === 'custom') && (
                          <div className="flex flex-wrap gap-1">
                            {[
                              { day: 1, label: 'Пн' },
                              { day: 2, label: 'Вт' },
                              { day: 3, label: 'Ср' },
                              { day: 4, label: 'Чт' },
                              { day: 5, label: 'Пт' },
                              { day: 6, label: 'Сб' },
                              { day: 7, label: 'Вс' },
                            ].map(({ day, label }) => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleEditingHabitDay(day)}
                                className={`w-9 h-9 rounded-lg text-xs font-medium transition-colors ${
                                  editingHabitDays.includes(day)
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => void handleDeleteHabitFromEditor()}
                            className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors text-sm"
                          >
                            Удалить
                          </button>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={closeHabitEditor}
                              className="px-3 py-1.5 border border-gray-700 text-gray-200 rounded-lg hover:bg-gray-800 transition-colors text-sm"
                            >
                              Отмена
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSaveHabit()}
                              disabled={
                                editingHabitText.trim().length === 0 ||
                                ((editingHabitFrequency === 'weekly' || editingHabitFrequency === 'custom') && editingHabitDays.length === 0)
                              }
                              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 text-sm"
                            >
                              Сохранить
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                )}
              </div>
            )
          })()}

          {/* Предложения создать привычки */}
          {habitSuggestions.filter(s => !dismissedSuggestions.has(s.text)).length > 0 && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mr-6">
              <h3 className="font-medium text-amber-200 text-sm mb-2">Сделать привычкой?</h3>
              <div className="space-y-2">
                {habitSuggestions.filter(s => !dismissedSuggestions.has(s.text)).slice(0, 3).map((suggestion, index) => (
                  <div key={index} className="flex items-center justify-between text-sm gap-2">
                    <span className="text-amber-300 truncate flex-1">
                      &ldquo;{suggestion.text}&rdquo; — {suggestion.totalCount} раз
                    </span>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => createHabitFromTask(suggestion.text)}
                        className="w-6 h-6 flex items-center justify-center bg-green-600 hover:bg-green-500 text-white text-sm rounded transition-colors"
                        title="Создать привычку"
                      >
                        
                      </button>
                      <button
                        onClick={() => setDismissedSuggestions(prev => new Set([...prev, suggestion.text]))}
                        className="w-6 h-6 flex items-center justify-center bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors"
                        title="Скрыть"
                      >
                        
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Список задач */}
          <div ref={tasksContainerRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-6 chat-scrollbar">
            {tasks.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">
                Добавьте задачи на день...
              </p>
            ) : (
              <>
                {/* Невыполненные задачи */}
                {activeTasks.map((task) => {
                  const index = tasks.findIndex(t => t.id === task.id)
                  const habit = getHabitForTask(task.taskText)
                  const isPostponeActive = activeTaskAction?.taskId === task.id && activeTaskAction.type === 'postpone'
                  const isHabitActive = activeTaskAction?.taskId === task.id && (activeTaskAction.type === 'habit-create' || activeTaskAction.type === 'habit-remove')
                  const isDeleteActive = activeTaskAction?.taskId === task.id && activeTaskAction.type === 'delete'

                  return (
                    <div
                      key={task.id}
                      ref={activeTaskAction?.taskId === task.id ? activeTaskActionRowRef : undefined}
                      className="relative"
                    >
                      <div
                        draggable={editingTaskId !== task.id}
                        onDragStart={() => handleDragStart(task.id)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(task.id)}
                        className={`flex items-center gap-2 py-1 px-2 rounded-lg border transition-colors ${
                          editingTaskId === task.id ? 'cursor-text' : 'cursor-move'
                        } ${
                      selectedTasks.has(task.id)
                        ? 'bg-green-500/10 border-green-500/20'
                        : savedFlags[index]
                          ? 'bg-gray-900/80 border-gray-700 hover:border-gray-600'
                          : 'bg-gray-900/80 border-gray-700 hover:border-gray-600 opacity-60'
                    } ${draggedTaskId === task.id ? 'opacity-50' : ''}`}
                      >
                        <span className="text-gray-500 cursor-grab active:cursor-grabbing">⋮⋮</span>
                        <input
                          type="checkbox"
                          checked={selectedTasks.has(task.id)}
                          onChange={() => toggleTaskSelection(task.id)}
                        />

                        {editingTaskId === task.id ? (
                          <textarea
                            value={editingTaskText}
                            onChange={(e) => setEditingTaskText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                saveEditedTask(task.id)
                              } else if (e.key === 'Escape') {
                                cancelEditingTask()
                              }
                            }}
                            onBlur={() => saveEditedTask(task.id)}
                            autoFocus
                            rows={1}
                            ref={(el) => {
                              if (el) {
                                el.style.height = 'auto'
                                el.style.height = el.scrollHeight + 'px'
                              }
                            }}
                            onInput={(e) => {
                              const el = e.currentTarget
                              el.style.height = 'auto'
                              el.style.height = el.scrollHeight + 'px'
                            }}
                            className="flex-1 px-2 py-1 text-base border border-primary-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-800 text-gray-100 resize-none overflow-hidden leading-relaxed"
                          />
                        ) : (
                          <span
                            className={`flex-1 text-base text-gray-100 ${selectedTasks.has(task.id) ? 'line-through text-gray-400' : ''}`}
                            onDoubleClick={() => startEditingTask(task.id, task.taskText)}
                            title="Дважды кликните для редактирования"
                          >
                            {task.taskText}
                          </span>
                        )}

                        <button
                          onClick={() => toggleTaskAction(task.id, 'postpone')}
                          className={`${taskActionButtonBase} ${
                            isPostponeActive
                              ? 'border-blue-400/35 bg-blue-500/5 text-blue-300'
                              : 'border-transparent text-blue-300/65 hover:border-blue-400/20 hover:bg-blue-500/5 hover:text-blue-200'
                          }`}
                          title="Перенести на дату"
                          aria-pressed={isPostponeActive}
                        >
                          <TaskPostponeIcon className="h-[18px] w-[18px]" />
                        </button>

                        <button
                          onClick={() => toggleTaskAction(task.id, habit ? 'habit-remove' : 'habit-create')}
                          className={`${taskActionButtonBase} ${
                            isHabitActive
                              ? 'border-amber-400/35 bg-amber-500/5 text-amber-300'
                              : 'border-transparent text-amber-300/65 hover:border-amber-400/20 hover:bg-amber-500/5 hover:text-amber-200'
                          }`}
                          title={habit ? 'Снять цикличность' : 'Сделать привычкой'}
                          aria-pressed={isHabitActive}
                        >
                          <TaskRepeatIcon className="h-[18px] w-[18px]" />
                        </button>

                        <button
                          onClick={() => toggleTaskAction(task.id, 'delete')}
                          className={`${taskActionButtonBase} ${
                            isDeleteActive
                              ? 'border-red-400/35 bg-red-500/5 text-red-300'
                              : 'border-transparent text-red-300/65 hover:border-red-400/20 hover:bg-red-500/5 hover:text-red-200'
                          }`}
                          title="Удалить задачу"
                          aria-pressed={isDeleteActive}
                        >
                          <TaskDeleteIcon className="h-[18px] w-[18px]" />
                        </button>
                      </div>

                      {activeTaskAction?.taskId === task.id && (
                        <div className={`absolute right-2 top-full z-30 mt-1 rounded-lg border border-gray-700/45 bg-gray-900/25 px-2.5 py-1.5 shadow-none ring-1 ring-white/5 backdrop-blur-sm ${
                          activeTaskAction.type === 'postpone'
                            ? 'min-w-[300px]'
                            : activeTaskAction.type === 'delete'
                              ? 'min-w-[190px]'
                              : activeTaskAction.type === 'habit-create'
                                ? 'w-[500px] max-w-[calc(100%-3rem)]'
                                : 'min-w-[220px]'
                        }`}>
                          {activeTaskAction.type === 'postpone' && (
                            <div className="flex items-center justify-between gap-3">
                              <label className="flex items-center gap-2 text-xs text-gray-300">
                                <span>Перенести на</span>
                                <input
                                  type="date"
                                  value={postponeTargetDate}
                                  min={getNextDateKey(selectedDate)}
                                  onChange={(event) => setPostponeTargetDate(event.target.value)}
                                  className="h-8 rounded-md border border-gray-700/70 bg-transparent px-2 text-sm text-gray-100 outline-none transition-colors hover:border-gray-500/70 focus:border-gray-400/80"
                                />
                              </label>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    postponeTask(task.id, task.taskText, postponeTargetDate)
                                    closeTaskAction()
                                  }}
                                  disabled={!postponeTargetDate}
                                  className={`${confirmButtonBase} text-green-300/80 hover:bg-green-500/10 hover:text-green-200 disabled:opacity-40`}
                                >
                                  <CheckIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={closeTaskAction}
                                  className={`${confirmButtonBase} text-gray-500 hover:bg-gray-800/50 hover:text-gray-300`}
                                >
                                  <CloseIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          )}

                          {activeTaskAction.type === 'delete' && (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs text-gray-300">Удалить задачу?</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    removeTask(task.id)
                                    closeTaskAction()
                                  }}
                                  className={`${confirmButtonBase} text-green-300/80 hover:bg-green-500/10 hover:text-green-200`}
                                >
                                  <CheckIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={closeTaskAction}
                                  className={`${confirmButtonBase} text-gray-500 hover:bg-gray-800/50 hover:text-gray-300`}
                                >
                                  <CloseIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          )}

                          {activeTaskAction.type === 'habit-remove' && habit && (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs text-gray-300">Снять цикличность?</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={async () => {
                                    await deleteHabit(habit.id)
                                    closeTaskAction()
                                  }}
                                  className={`${confirmButtonBase} text-green-300/80 hover:bg-green-500/10 hover:text-green-200`}
                                >
                                  <CheckIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={closeTaskAction}
                                  className={`${confirmButtonBase} text-gray-500 hover:bg-gray-800/50 hover:text-gray-300`}
                                >
                                  <CloseIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          )}

                          {activeTaskAction.type === 'habit-create' && (
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-gray-300">Сделать привычкой:</span>
                                {[
                                  { value: 'daily', label: 'Ежедневно' },
                                  { value: 'weekdays', label: 'Будни' },
                                  { value: 'weekends', label: 'Выходные' },
                                  { value: 'weekly', label: 'Раз в неделю' },
                                  { value: 'custom', label: 'Свои дни' },
                                ].map(option => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setHabitFrequency(option.value as FrequencyType)}
                                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                                      habitFrequency === option.value
                                        ? 'border-gray-500/60 bg-gray-700/45 text-gray-100'
                                        : 'border-gray-700/60 bg-transparent text-gray-400 hover:border-gray-600 hover:bg-gray-800/35 hover:text-gray-200'
                                    }`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>

                              {(habitFrequency === 'weekly' || habitFrequency === 'custom') && (
                                <div className="flex flex-wrap gap-1">
                                  {[
                                    { day: 1, label: 'Пн' },
                                    { day: 2, label: 'Вт' },
                                    { day: 3, label: 'Ср' },
                                    { day: 4, label: 'Чт' },
                                    { day: 5, label: 'Пт' },
                                    { day: 6, label: 'Сб' },
                                    { day: 7, label: 'Вс' },
                                  ].map(({ day, label }) => (
                                    <button
                                      key={day}
                                      type="button"
                                      onClick={() => toggleDay(day)}
                                      className={`h-8 w-8 rounded-md border text-xs font-medium transition-colors ${
                                        habitDays.includes(day)
                                          ? 'border-gray-500/60 bg-gray-700/45 text-gray-100'
                                          : 'border-gray-700/60 bg-transparent text-gray-400 hover:border-gray-600 hover:bg-gray-800/35 hover:text-gray-200'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              )}

                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={closeTaskAction}
                                  className="rounded-md border border-gray-700/70 bg-transparent px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-600 hover:bg-gray-800/35 hover:text-gray-200"
                                >
                                  Отмена
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleCreateHabit(task.taskText)}
                                  disabled={(habitFrequency === 'weekly' || habitFrequency === 'custom') && habitDays.length === 0}
                                  className="rounded-md border border-gray-500/60 bg-gray-700/45 px-3 py-1.5 text-xs text-gray-100 transition-colors hover:bg-gray-700/65 disabled:opacity-40"
                                >
                                  Создать
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Выполненные задачи — карточка-триггер + список */}
                {completedTasks.length > 0 && (
                  <div className="mt-auto flex-shrink-0 space-y-2 pt-2">
                    {/* Карточка "Выполнено" в стиле задачи */}
                    <div
                      onClick={() => setShowCompleted(!showCompleted)}
                      className="flex items-center gap-2 py-1 px-2 rounded-lg border cursor-pointer transition-colors bg-green-900/20 border-green-500/20 hover:border-green-600"
                    >
                      <span className="text-gray-500 text-xs w-4 text-center">
                        {showCompleted ? '▼' : '▶'}
                      </span>
                      
                      <span className="flex-1 text-base text-green-400 font-medium">
                        Выполнено ({completedTasks.length})
                      </span>
                    </div>
                    
                    {/* Выполненные задачи — появляются с анимацией */}
                    <div className={`grid transition-[grid-template-rows,opacity] duration-200 ${
                      showCompleted ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}>
                      <div className={`min-h-0 space-y-2 ${showCompleted ? 'overflow-visible' : 'overflow-hidden'}`}>
                        {completedTasks.map((task) => (
                          <div
                            key={task.id}
                            ref={activeTaskAction?.taskId === task.id ? activeTaskActionRowRef : undefined}
                            className="relative"
                          >
                          <div className="flex items-center gap-2 py-1 px-2 rounded-lg border transition-colors bg-gray-900/80 border-gray-700 opacity-50 hover:opacity-70">
                            <input
                              type="checkbox"
                              checked={true}
                              onChange={() => toggleTaskSelection(task.id)}
                            />
                            <span className="flex-1 text-base text-gray-400">
                              {task.taskText}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleTaskAction(task.id, 'delete')
                              }}
                              className={`${taskActionButtonBase} ${
                                activeTaskAction?.taskId === task.id && activeTaskAction.type === 'delete'
                                  ? 'border-red-400/35 bg-red-500/5 text-red-300'
                                  : 'border-transparent text-red-300/65 hover:border-red-400/20 hover:bg-red-500/5 hover:text-red-200'
                              }`}
                              title="Удалить задачу"
                              aria-pressed={activeTaskAction?.taskId === task.id && activeTaskAction.type === 'delete'}
                            >
                              <TaskDeleteIcon className="h-[18px] w-[18px]" />
                            </button>
                          </div>

                          {activeTaskAction?.taskId === task.id && activeTaskAction.type === 'delete' && (
                            <div className="absolute right-2 top-full z-30 mt-1 min-w-[190px] rounded-lg border border-gray-700/45 bg-gray-900/25 px-2.5 py-1.5 shadow-none ring-1 ring-white/5 backdrop-blur-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs text-gray-300">Удалить задачу?</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      removeTask(task.id)
                                      closeTaskAction()
                                    }}
                                    className={`${confirmButtonBase} text-green-300/80 hover:bg-green-500/10 hover:text-green-200`}
                                  >
                                    <CheckIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      closeTaskAction()
                                    }}
                                    className={`${confirmButtonBase} text-gray-500 hover:bg-gray-800/50 hover:text-gray-300`}
                                  >
                                    <CloseIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Вне плана (перевыполнение) */}
          <div className="mt-4 p-3 bg-gray-900 border border-gray-700 rounded-lg mr-6">
            <h3 className="font-medium text-base text-gray-300 mb-2">+ Вне плана (перевыполнение)</h3>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newExtraTaskText}
                onChange={(e) => setNewExtraTaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addExtraTask()
                  }
                }}
                placeholder="Добавить сделанное вне плана..."
                className="flex-1 px-3 py-2 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-800 text-gray-100 placeholder-gray-400"
              />
              <button onClick={addExtraTask} className="btn-primary text-sm py-2">
                Добавить
              </button>
            </div>

            {extraTasks.length > 0 && (
              <div className="space-y-1">
                {extraTasks.map((text, index) => (
                  <div key={`${index}-${text}`} className="flex items-center justify-between gap-2 text-sm bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-100">
                    {editingExtraTaskIndex === index ? (
                      <input
                        type="text"
                        value={editingExtraTaskText}
                        onChange={(e) => setEditingExtraTaskText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            saveEditedExtraTask(index)
                          } else if (e.key === 'Escape') {
                            cancelEditingExtraTask()
                          }
                        }}
                        onBlur={() => saveEditedExtraTask(index)}
                        autoFocus
                        className="flex-1 px-2 py-1 text-sm border border-primary-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-800 text-gray-100"
                      />
                    ) : (
                      <span
                        className="flex-1 cursor-default"
                        onDoubleClick={() => startEditingExtraTask(index, text)}
                        title="Дважды кликните для редактирования"
                      >
                        {text}
                      </span>
                    )}
                    {confirmExtraDelete === index ? (
                      <div className="flex items-center gap-1 rounded-md border border-gray-700/45 bg-gray-900/25 px-1.5 py-0.5 shadow-none ring-1 ring-white/5 backdrop-blur-sm">
                        <span className="text-xs text-gray-300">Удалить?</span>
                        <button
                          onClick={() => {
                            removeExtraTask(index)
                            setConfirmExtraDelete(null)
                          }}
                          className={`${confirmButtonBase} text-gray-300 hover:bg-gray-800/50 hover:text-green-300`}
                        >
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmExtraDelete(null)}
                          className={`${confirmButtonBase} text-gray-500 hover:bg-gray-800/50 hover:text-gray-300`}
                        >
                          <CloseIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmExtraDelete(index)}
                        className={`${taskActionButtonBase} border-transparent text-red-300/65 hover:border-red-400/20 hover:bg-red-500/5 hover:text-red-200`}
                        title="Удалить"
                      >
                        <TaskDeleteIcon className="h-[18px] w-[18px]" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Основные действия - закреплены внизу */}
          <div className="mt-auto pt-4 flex-shrink-0 pr-6">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button 
                  onClick={savePlan} 
                  disabled={saving} 
                  className={`btn-primary w-full disabled:opacity-50 sm:flex-1 ${showSavePlanAttention ? 'btn-dirty-attention' : ''}`}
                >
                  {saving ? 'Сохранение...' : 'Сохранить план'}
                </button>

                {!hasEvaluation ? (
                  <button
                    onClick={handleEvaluateClick}
                    disabled={evaluating || selectedTasks.size === 0}
                    className="btn-secondary flex w-full items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 sm:w-auto"
                  >
                    {evaluating ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Анализирую...
                      </>
                    ) : 'Оценить день'}
                  </button>
                ) : (
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <button
                      onClick={() => router.push(`/evaluation/${selectedDate}`)}
                      className="btn-secondary w-full whitespace-nowrap sm:w-auto"
                    >
                      Посмотреть оценку →
                    </button>
                    <button
                      onClick={handleEvaluateClick}
                      disabled={evaluating || selectedTasks.size === 0}
                      className={`btn-secondary flex w-full items-center justify-center gap-2 whitespace-nowrap text-sm disabled:opacity-50 sm:w-auto ${planChangedAfterEval ? 'ring-2 ring-orange-400' : ''}`}
                    >
                      {evaluating ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Анализирую...
                        </>
                      ) : planChangedAfterEval ? 'Обновить оценку ↻' : 'Получить заново'}
                    </button>
                  </div>
                )}
              </div>

              {message && (
                <div className={`flex items-center gap-2 text-sm transition-all duration-300 ${
                  message.includes('Ошибка') ? 'text-red-400' : message.includes('получена') ? 'text-green-400' : 'text-slate-400'
                }`}>
                  {message.includes('Ошибка') && (
                    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {message.includes('получена') && (
                    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  <span>{message}</span>
                </div>
              )}
            </div>
          </div>
            </>
          ) : scheduleMode === 'timeline' ? (
            schedule ? (
              <DayTimeline
                schedule={schedule}
                tasks={tasks}
                selectedTasks={selectedTasks}
                unscheduledTaskIndexes={unscheduledTaskIndexes}
                isSaving={scheduleSaving}
                isDirty={scheduleDirty}
                error={scheduleError}
                onSetBlockRange={setBlockRange}
                onMoveBlock={moveBlockByStep}
                onRemoveBlock={removeBlock}
                onScheduleUnscheduled={scheduleUnscheduledTask}
                appliedAnimationKey={appliedAnimationKey}
                mutationLocked={timelineMutationLocked}
              />
            ) : scheduleLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
                Загрузка расписания…
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
                Не удалось загрузить расписание.
              </div>
            )
          ) : null}
        </div>

        {/* Chat - Right (40%) */}
        <div className="lg:col-span-2 card flex flex-col" style={{ minHeight: '500px', maxHeight: '80vh' }}>
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h2 className="text-xl font-bold">Обсуждение плана с Ассистентом</h2>
            {chatMessages.length > 0 && (
              <button 
                onClick={clearChat}
                className="text-sm text-gray-400 hover:text-gray-200"
                title="Очистить чат"
              >
                Очистить
              </button>
            )}
          </div>

          {/* Сообщения чата - занимает всё свободное пространство */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto space-y-3 py-2 -mr-6 pr-3 chat-scrollbar"
          >
            {chatMessages.length === 0 ? (
              <div className="py-4 space-y-3">
                <p className="text-center text-gray-500 text-sm mb-4">Спросите Ассистента:</p>
                <button
                  onClick={() => void handleSendChatMessage('Проанализируй мой план на день и дай рекомендации')}
                  disabled={sendingChat || isSubmittingChat || tasks.length === 0}
                  className="w-full p-3 text-left bg-gray-800 hover:bg-gray-600 border border-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >

                  <span className="text-sm font-medium text-gray-200">Проанализировать план</span>
                </button>
                <button
                  onClick={() => void handleSendChatMessage('Оцени временные затраты на каждую задачу и скажи, реалистичен ли план по времени')}
                  disabled={sendingChat || isSubmittingChat || tasks.length === 0}
                  className="w-full p-3 text-left bg-gray-800 hover:bg-gray-600 border border-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >

                  <span className="text-sm font-medium text-gray-200">Оценить время</span>
                </button>
                <button
                  onClick={() => void handleSendChatMessage('Как мой план связан с целями недели и месяца? Какие задачи стоит добавить?')}
                  disabled={sendingChat || isSubmittingChat || tasks.length === 0}
                  className="w-full p-3 text-left bg-gray-800 hover:bg-gray-600 border border-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >

                  <span className="text-sm font-medium text-gray-200">Связь с целями</span>
                </button>
                {tasks.length === 0 && (
                  <p className="text-center text-xs text-gray-500 mt-2">
                    Добавьте задачи в план
                  </p>
                )}
              </div>
            ) : (
              chatMessages.map((msg, index) => (
                <div
                  key={msg.id ?? index}
                  className={msg.role === 'user'
                    ? 'flex justify-end'
                    : ''
                  }
                >
                  {msg.role === 'user' ? (
                    <div className="max-w-[85%] bg-primary-900/30 rounded-2xl px-4 py-2.5">
                      <p className="text-[15px] whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="py-1">
                      <div className="text-sm font-medium text-gray-400 mb-1">Ассистент</div>
                      <p className="text-[15px] whitespace-pre-wrap">{msg.content}</p>
                      {msg.metadata?.type === 'daily_schedule_proposal' && !dismissedProposalIds.has(msg.id ?? '') && (
                        <DailyScheduleProposalCard
                          metadata={msg.metadata}
                          messageId={isPendingChatMessageId(msg.id) ? undefined : msg.id}
                          isApplying={applyingProposalId === msg.id}
                          onApply={(options) => handleApplyProposal(msg.id, msg.metadata!, options)}
                          onDiscuss={() => handleDiscussProposal('Хочу скорректировать черновик расписания: ')}
                          onDismiss={() => handleDismissProposal(msg.id)}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
            {sendingChat && !hasStreamingAssistantResponse && (
              <div className="py-1">
                <div className="text-sm font-medium text-gray-400 mb-1">Ассистент</div>
                <span className="text-sm text-gray-500">печатает...</span>
              </div>
            )}
          </div>

          {/* Ввод сообщения - прижато к низу */}
          <div className="flex gap-2 items-center mt-3 flex-shrink-0">
            <textarea
              ref={chatTextareaRef}
              value={chatInput}
              onChange={(e) => {
                setChatInput(e.target.value)
                resizeChatTextarea(e.target, e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSendChatMessage()
                }
              }}
              placeholder="Напишите сообщение..."
              disabled={sendingChat || isSubmittingChat}
              rows={1}
              className="flex-1 px-3 py-2 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-800 bg-gray-800 text-gray-100 placeholder-gray-400 resize-none overflow-hidden"
              style={{ minHeight: '42px' }}
            />
            <button
              onClick={() => void handleSendChatMessage()}
              disabled={sendingChat || isSubmittingChat || !chatInput.trim()}
              className="self-end mb-0.5 w-10 h-10 flex items-center justify-center bg-primary-500 hover:bg-primary-600 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors flex-shrink-0"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Модалка невыполненных задач */}
      {showUncompletedModal && (
        <UncompletedTasksModal
          tasks={uncompletedTasks}
          currentDate={selectedDate}
          onComplete={handleUncompletedDecisions}
          onCancel={() => setShowUncompletedModal(false)}
        />
      )}
    </div>
  )
}
