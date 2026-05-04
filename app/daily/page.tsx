'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { useDaily } from '@/hooks/useDaily'
import DatePickerWithIndicators from '@/components/DatePickerWithIndicators'
import UncompletedTasksModal, { TaskDecision, UncompletedTask } from '@/components/UncompletedTasksModal'
import { areTasksSimilar } from '@/lib/task-match'
import { fetchJson, getFetchErrorMessage } from '@/lib/fetch-json'

type FrequencyType = 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'custom'
type TaskActionType = 'delete' | 'postpone' | 'habit-create' | 'habit-remove'

type FactsResponse = {
  items: Array<{ id: number; text: string; type: string; category: string | null }>
  stats: { total: number }
}

export default function DailyPage() {
  const router = useRouter()
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const newTaskTextareaRef = useRef<HTMLTextAreaElement>(null)
  const activeTaskActionRowRef = useRef<HTMLDivElement | null>(null)
  const habitEditorRef = useRef<HTMLDivElement | null>(null)
  const tasksContainerRef = useRef<HTMLDivElement | null>(null)
  const [mounted, setMounted] = useState(false)
  const [showUncompletedModal, setShowUncompletedModal] = useState(false)
  const [uncompletedTasks, setUncompletedTasks] = useState<UncompletedTask[]>([])

  const [habitFrequency, setHabitFrequency] = useState<FrequencyType>('daily')
  const [habitDays, setHabitDays] = useState<number[]>([])
  const [editingHabitId, setEditingHabitId] = useState<number | null>(null)
  const [editingHabitText, setEditingHabitText] = useState('')
  const [editingHabitFrequency, setEditingHabitFrequency] = useState<FrequencyType>('daily')
  const [editingHabitDays, setEditingHabitDays] = useState<number[]>([])
  
  // Локальное состояние action-кнопок строки задачи
  const [activeTaskAction, setActiveTaskAction] = useState<{ taskId: number; type: TaskActionType } | null>(null)
  
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
  const [weekFacts, setWeekFacts] = useState<Array<{ id: number; text: string; type: string; category: string | null }>>([])
  const [weekFactsTotal, setWeekFactsTotal] = useState(0)
  const [showWeekFacts, setShowWeekFacts] = useState(false)
  // Виджет «Сделано сегодня»
  const [todayFacts, setTodayFacts] = useState<Array<{ id: number; text: string; type: string; category: string | null }>>([])
  const [todayFactsTotal, setTodayFactsTotal] = useState(0)
  const [showTodayFacts, setShowTodayFacts] = useState(false)
  
  // Сохраняем отклонённые предложения в localStorage
  useEffect(() => {
    if (dismissedSuggestions.size > 0) {
      localStorage.setItem('dismissedHabitSuggestions', JSON.stringify([...dismissedSuggestions]))
    }
  }, [dismissedSuggestions])

  // Автоскролл полотна задач к низу при раскрытии блока «Выполнено»
  // (ждём окончания CSS-перехода max-h, иначе scrollHeight ещё не обновлён)
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
    // Перeход max-h занимает 200ms — даём чуть больше, чтобы scrollHeight успел вырасти
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

  // Заголовок для блока целей недели с датами
  const weekLabel = useMemo(() => {
    const date = new Date(selectedDate)
    const weekStart = startOfWeek(date, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 })
    const startDay = format(weekStart, 'd', { locale: ru })
    const endDay = format(weekEnd, 'd', { locale: ru })
    const month = format(weekEnd, 'MMM', { locale: ru }).replace('.', '')
    return `План на неделю ${startDay}-${endDay} ${month}`
  }, [selectedDate])

  // Заголовок для блока целей месяца
  const monthLabel = useMemo(() => {
    const date = new Date(selectedDate)
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
    }
  }, [])

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
      showMessage('❌ Название привычки не может быть пустым')
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
  const taskIdSet = new Set(tasks.map(t => t.id))
  const completedCount = Array.from(selectedTasks).filter(id => taskIdSet.has(id)).length
  const totalCount = tasks.length
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const extraDoneCount = extraTasks.length

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

  // Загрузка фактов текущей недели и сегодня
  useEffect(() => {
    (async () => {
      try {
        const [weekResult, todayResult] = await Promise.allSettled([
          fetchJson<FactsResponse>('/api/facts?period=week&limit=200'),
          fetchJson<FactsResponse>(`/api/facts?from=${selectedDate}&to=${selectedDate}&limit=200`),
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

        if (todayResult.status === 'fulfilled') {
          // Сегодня — всё выполненное
          setTodayFacts(todayResult.value.items)
          setTodayFactsTotal(todayResult.value.stats.total)
        } else {
          console.error('Error loading today facts:', todayResult.reason)
          setTodayFacts([])
          setTodayFactsTotal(0)
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
        {mounted ? format(new Date(selectedDate), 'd MMMM yyyy, EEEE', { locale: ru }) : '\u00A0'}
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

      {/* Виджеты «Сделано сегодня» и «Сделано на этой неделе» */}
      {(todayFactsTotal > 0 || weekFactsTotal > 0) && (
        <div className={`grid grid-cols-1 ${todayFactsTotal > 0 && weekFactsTotal > 0 ? 'md:grid-cols-2' : ''} gap-4`}>
          {/* Сделано сегодня */}
          {todayFactsTotal > 0 && (
          <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-4">
            <button
              onClick={() => setShowTodayFacts(!showTodayFacts)}
              className="w-full flex items-center justify-between"
            >
              <h3 className="text-sm font-medium text-blue-300">
                Сделано сегодня: {todayFactsTotal} {todayFactsTotal === 1 ? 'дело' : todayFactsTotal >= 2 && todayFactsTotal <= 4 ? 'дела' : 'дел'}
              </h3>
              <span className="text-blue-400 text-xs">{showTodayFacts ? '▲ скрыть' : '▼ показать'}</span>
            </button>
            {showTodayFacts && (
              <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                {todayFacts.map(item => (
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

          {/* Сделано на этой неделе */}
          {weekFactsTotal > 0 && (
          <div className="rounded-xl bg-green-500/5 border border-green-500/20 p-4">
            <button
              onClick={() => setShowWeekFacts(!showWeekFacts)}
              className="w-full flex items-center justify-between"
            >
              <h3 className="text-sm font-medium text-green-300">
                Сделано на неделе: {weekFactsTotal} {weekFactsTotal === 1 ? 'дело' : weekFactsTotal >= 2 && weekFactsTotal <= 4 ? 'дела' : 'дел'}
              </h3>
              <span className="text-green-400 text-xs">{showWeekFacts ? '▲ скрыть' : '▼ показать'}</span>
            </button>
            {showWeekFacts && (
              <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                {weekFacts.map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <span className="text-green-500">✓</span>
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
          <div className="flex items-center justify-between mb-4 flex-shrink-0 pr-6">
            <h2 className="text-xl font-bold">План на день</h2>
            {totalCount > 0 && (
              <span className={`text-sm px-3 py-1 rounded-full ${
                completionPercent === 100 ? 'bg-green-500/15 text-green-400' :
                completionPercent >= 50 ? 'bg-yellow-500/15 text-yellow-400' :
                'bg-gray-800 text-gray-400'
              }`}>
                {completedCount}/{totalCount} ({completionPercent}%)
                {extraDoneCount > 0 && ` +${extraDoneCount}`}
              </span>
            )}
          </div>

          {/* Добавление новой задачи */}
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
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mr-6">
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
                <div className="mt-3 pt-3 border-t border-amber-500/20">
                  {habitsNotInPlan.length > 0 && (
                    <div className="mb-2 flex justify-end">
                      <button
                        onClick={() => addHabitsToTasks()}
                        className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-2 py-1 rounded transition-colors"
                      >
                        + Все в план
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
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
          <div ref={tasksContainerRef} className="space-y-2 flex-1 overflow-y-auto pr-6 chat-scrollbar">
            {tasks.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">
                Добавьте задачи на день...
              </p>
            ) : (
              <>
                {/* Невыполненные задачи */}
                {tasks.filter(t => !selectedTasks.has(t.id)).map((task) => {
                  const index = tasks.findIndex(t => t.id === task.id)
                  const habit = getHabitForTask(task.taskText)
                  const isPostponeActive = activeTaskAction?.taskId === task.id && activeTaskAction.type === 'postpone'
                  const isHabitActive = activeTaskAction?.taskId === task.id && (activeTaskAction.type === 'habit-create' || activeTaskAction.type === 'habit-remove')
                  const isDeleteActive = activeTaskAction?.taskId === task.id && activeTaskAction.type === 'delete'

                  return (
                    <div
                      key={task.id}
                      ref={activeTaskAction?.taskId === task.id ? activeTaskActionRowRef : undefined}
                      className="space-y-2"
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
                          <input
                            type="text"
                            value={editingTaskText}
                            onChange={(e) => setEditingTaskText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                saveEditedTask(task.id)
                              } else if (e.key === 'Escape') {
                                cancelEditingTask()
                              }
                            }}
                            onBlur={() => saveEditedTask(task.id)}
                            autoFocus
                            className="flex-1 px-2 py-1 text-base border border-primary-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-800 text-gray-100"
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
                          className={`w-8 h-8 flex items-center justify-center text-2xl leading-none rounded transition-all ${
                            isPostponeActive
                              ? 'bg-blue-500/15 text-blue-300 opacity-100'
                              : 'text-blue-500 hover:text-blue-400 hover:bg-gray-700 opacity-70 hover:opacity-100'
                          }`}
                          title="Перенести на завтра"
                          aria-pressed={isPostponeActive}
                        >
                          →
                        </button>

                        <button
                          onClick={() => toggleTaskAction(task.id, habit ? 'habit-remove' : 'habit-create')}
                          className={`w-8 h-8 flex items-center justify-center text-2xl leading-none rounded transition-all ${
                            isHabitActive
                              ? 'bg-amber-500/15 text-amber-300 opacity-100'
                              : 'text-amber-500 hover:text-amber-400 hover:bg-gray-700 opacity-70 hover:opacity-100'
                          }`}
                          title={habit ? 'Снять цикличность' : 'Сделать привычкой'}
                          aria-pressed={isHabitActive}
                        >
                          ↻
                        </button>

                        <button
                          onClick={() => toggleTaskAction(task.id, 'delete')}
                          className={`w-8 h-8 flex items-center justify-center text-2xl leading-none rounded transition-all ${
                            isDeleteActive
                              ? 'bg-red-500/15 text-red-300 opacity-100'
                              : 'text-red-500 hover:text-red-400 hover:bg-gray-700 opacity-70 hover:opacity-100'
                          }`}
                          title="Удалить задачу"
                          aria-pressed={isDeleteActive}
                        >
                          ×
                        </button>
                      </div>

                      {activeTaskAction?.taskId === task.id && (
                        <div className={`ml-10 mr-2 rounded-lg border px-3 py-2 ${
                          activeTaskAction.type === 'postpone'
                            ? 'border-blue-500/20 bg-blue-500/10'
                            : activeTaskAction.type === 'delete'
                              ? 'border-red-500/20 bg-red-900/30'
                              : 'border-amber-500/20 bg-amber-500/10'
                        }`}>
                          {activeTaskAction.type === 'postpone' && (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm text-blue-300">Перенести задачу на завтра?</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    postponeTask(task.id, task.taskText)
                                    closeTaskAction()
                                  }}
                                  className="w-6 h-6 flex items-center justify-center text-green-400 hover:bg-green-500/15 rounded text-lg leading-none"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={closeTaskAction}
                                  className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-700 rounded text-lg leading-none"
                                >
                                  ✗
                                </button>
                              </div>
                            </div>
                          )}

                          {activeTaskAction.type === 'delete' && (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm text-red-300">Удалить задачу?</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    removeTask(task.id)
                                    closeTaskAction()
                                  }}
                                  className="w-6 h-6 flex items-center justify-center text-green-400 hover:bg-green-500/15 rounded text-lg leading-none"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={closeTaskAction}
                                  className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-700 rounded text-lg leading-none"
                                >
                                  ✗
                                </button>
                              </div>
                            </div>
                          )}

                          {activeTaskAction.type === 'habit-remove' && habit && (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm text-amber-200">Снять цикличность с задачи?</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={async () => {
                                    await deleteHabit(habit.id)
                                    closeTaskAction()
                                  }}
                                  className="w-6 h-6 flex items-center justify-center text-green-400 hover:bg-green-500/15 rounded text-lg leading-none"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={closeTaskAction}
                                  className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-700 rounded text-lg leading-none"
                                >
                                  ✗
                                </button>
                              </div>
                            </div>
                          )}

                          {activeTaskAction.type === 'habit-create' && (
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm text-amber-200">Сделать привычкой:</span>
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
                                    className={`px-2 py-1 rounded-md text-xs transition-colors ${
                                      habitFrequency === option.value
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
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
                                      className={`w-9 h-9 rounded-lg text-xs font-medium transition-colors ${
                                        habitDays.includes(day)
                                          ? 'bg-amber-500 text-white'
                                          : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              )}

                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={closeTaskAction}
                                  className="px-3 py-1.5 border border-gray-700 text-gray-200 rounded-lg hover:bg-gray-800 transition-colors text-sm"
                                >
                                  Отмена
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleCreateHabit(task.taskText)}
                                  disabled={(habitFrequency === 'weekly' || habitFrequency === 'custom') && habitDays.length === 0}
                                  className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 text-sm"
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
                {tasks.filter(t => selectedTasks.has(t.id)).length > 0 && (
                  <>
                    {/* Карточка "Выполнено" в стиле задачи */}
                    <div
                      onClick={() => setShowCompleted(!showCompleted)}
                      className="flex items-center gap-2 py-1 px-2 rounded-lg border cursor-pointer transition-colors bg-green-900/20 border-green-500/20 hover:border-green-600"
                    >
                      <span className="text-gray-500 text-xs w-4 text-center">
                        {showCompleted ? '▼' : '▶'}
                      </span>
                      
                      <span className="flex-1 text-base text-green-400 font-medium">
                        Выполнено ({tasks.filter(t => selectedTasks.has(t.id)).length})
                      </span>
                    </div>
                    
                    {/* Выполненные задачи — появляются с анимацией */}
                    <div className={`space-y-2 overflow-hidden transition-all duration-200 ${
                      showCompleted ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                      {tasks.filter(t => selectedTasks.has(t.id)).map((task) => (
                        <div
                          key={task.id}
                          ref={activeTaskAction?.taskId === task.id ? activeTaskActionRowRef : undefined}
                          className="space-y-2"
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
                              className={`w-8 h-8 flex items-center justify-center text-2xl leading-none rounded transition-all ${
                                activeTaskAction?.taskId === task.id && activeTaskAction.type === 'delete'
                                  ? 'bg-red-500/15 text-red-300 opacity-100'
                                  : 'text-red-400 hover:text-red-300 hover:bg-gray-700 opacity-70 hover:opacity-100'
                              }`}
                              title="Удалить задачу"
                              aria-pressed={activeTaskAction?.taskId === task.id && activeTaskAction.type === 'delete'}
                            >
                              ×
                            </button>
                          </div>

                          {activeTaskAction?.taskId === task.id && activeTaskAction.type === 'delete' && (
                            <div className="ml-10 mr-2 rounded-lg border border-red-500/20 bg-red-900/30 px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm text-red-300">Удалить задачу?</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      removeTask(task.id)
                                      closeTaskAction()
                                    }}
                                    className="w-6 h-6 flex items-center justify-center text-green-400 hover:bg-green-500/15 rounded text-lg leading-none"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      closeTaskAction()
                                    }}
                                    className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-700 rounded text-lg leading-none"
                                  >
                                    ✗
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
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
                      <div className="flex items-center gap-1 bg-red-900/50 rounded px-1">
                        <span className="text-xs text-red-300">Удалить?</span>
                        <button
                          onClick={() => {
                            removeExtraTask(index)
                            setConfirmExtraDelete(null)
                          }}
                          className="w-6 h-6 flex items-center justify-center text-green-400 hover:bg-green-500/15 rounded text-lg leading-none"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setConfirmExtraDelete(null)}
                          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-700 rounded text-lg leading-none"
                        >
                          ✗
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmExtraDelete(index)}
                        className="w-8 h-8 flex items-center justify-center text-2xl leading-none text-red-500 hover:text-red-400 hover:bg-gray-700 rounded opacity-70 hover:opacity-100 transition-all"
                        title="Удалить"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Кнопка сохранения - закреплена внизу */}
          <div className="mt-auto pt-4 flex-shrink-0 pr-6">
            <button 
              onClick={savePlan} 
              disabled={saving} 
              className={`btn-primary disabled:opacity-50 w-full ${showSavePlanAttention ? 'btn-dirty-attention' : ''}`}
            >
              {saving ? 'Сохранение...' : 'Сохранить план'}
            </button>
          </div>
        </div>

        {/* Chat - Right (40%) */}
        <div className="lg:col-span-2 card flex flex-col" style={{ minHeight: '500px', maxHeight: '80vh' }}>
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h2 className="text-xl font-bold">Обсуждение плана с ION</h2>
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
                <p className="text-center text-gray-500 text-sm mb-4">Спросите ION:</p>
                <button
                  onClick={() => sendChatMessage('Проанализируй мой план на день и дай рекомендации')}
                  disabled={sendingChat || tasks.length === 0}
                  className="w-full p-3 text-left bg-gray-800 hover:bg-gray-600 border border-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >

                  <span className="text-sm font-medium text-gray-200">Проанализировать план</span>
                </button>
                <button
                  onClick={() => sendChatMessage('Оцени временные затраты на каждую задачу и скажи, реалистичен ли план по времени')}
                  disabled={sendingChat || tasks.length === 0}
                  className="w-full p-3 text-left bg-gray-800 hover:bg-gray-600 border border-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >

                  <span className="text-sm font-medium text-gray-200">Оценить время</span>
                </button>
                <button
                  onClick={() => sendChatMessage('Как мой план связан с целями недели и месяца? Какие задачи стоит добавить?')}
                  disabled={sendingChat || tasks.length === 0}
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
                  key={index}
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
                      <div className="text-sm font-medium text-gray-400 mb-1">ION</div>
                      <p className="text-[15px] whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  )}
                </div>
              ))
            )}
            {sendingChat && (
              <div className="py-1">
                <div className="text-sm font-medium text-gray-400 mb-1">ION</div>
                <span className="text-sm text-gray-500">печатает...</span>
              </div>
            )}
          </div>

          {/* Ввод сообщения - прижато к низу */}
          <div className="flex gap-2 items-center mt-3 flex-shrink-0">
            <textarea
              value={chatInput}
              onChange={(e) => {
                setChatInput(e.target.value)
                // Автоматическое расширение
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendChatMessage()
                }
              }}
              placeholder="Напишите сообщение..."
              disabled={sendingChat}
              rows={1}
              className="flex-1 px-3 py-2 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-800 bg-gray-800 text-gray-100 placeholder-gray-400 resize-none overflow-hidden"
              style={{ minHeight: '42px' }}
            />
            <button
              onClick={() => sendChatMessage()}
              disabled={sendingChat || !chatInput.trim()}
              className="self-end mb-0.5 w-10 h-10 flex items-center justify-center bg-primary-500 hover:bg-primary-600 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors flex-shrink-0"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Evaluate */}
      <div className="card relative overflow-hidden bg-gradient-to-r from-primary-900/30 to-purple-900/30 border border-primary-700">
        {/* Animated progress bar */}
        {evaluating && (
          <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-[eval-progress_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
          </div>
        )}
        <h2 className="text-xl font-bold mb-4 text-white">Получить оценку дня от ION</h2>
        <p className="text-base text-gray-300 mb-4">
          После выполнения задач (отметьте чекбоксами), получите детальную оценку и обратную связь.
        </p>
        {(() => {
          const hasEvaluation = !!dailyEntry?.evaluation
          const planChangedAfterEval = hasEvaluation && dailyEntry?.updatedAt && dailyEntry.evaluation?.createdAt
            && new Date(dailyEntry.updatedAt) > new Date(dailyEntry.evaluation.createdAt)
          return (
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                {!hasEvaluation ? (
                  <button
                    onClick={handleEvaluateClick}
                    disabled={evaluating || selectedTasks.size === 0}
                    className="btn-primary disabled:opacity-50 flex items-center gap-2"
                  >
                    {evaluating ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Анализирую...
                      </>
                    ) : 'Получить оценку дня'}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => router.push(`/evaluation/${selectedDate}`)}
                      className="btn-primary"
                    >
                      Посмотреть оценку →
                    </button>
                    <button
                      onClick={handleEvaluateClick}
                      disabled={evaluating || selectedTasks.size === 0}
                      className={`btn-secondary text-sm disabled:opacity-50 flex items-center gap-2 ${planChangedAfterEval ? 'ring-2 ring-orange-400' : ''}`}
                    >
                      {evaluating ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Анализирую...
                        </>
                      ) : planChangedAfterEval ? 'Обновить оценку ↻' : 'Получить заново'}
                    </button>
                  </>
                )}
              </div>
              {/* Inline status message */}
              {message && (
                <div className={`flex items-center gap-2 text-sm transition-all duration-300 ${
                  message.includes('Ошибка') ? 'text-red-400' : message.includes('получена') ? 'text-green-400' : 'text-slate-400'
                }`}>
                  {message.includes('Ошибка') && (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {message.includes('получена') && (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {message}
                </div>
              )}
            </div>
          )
        })()}
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
