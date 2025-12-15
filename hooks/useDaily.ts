'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { getPeriodDates } from '@/lib/dates'
import { DailyEntry, OpenTask } from '@/lib/types'

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
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [planText, setPlanText] = useState('')
  const [factText, setFactText] = useState('')
  const [weekGoals, setWeekGoals] = useState<string[]>([])
  const [monthGoals, setMonthGoals] = useState<string[]>([])
  const [dailyEntry, setDailyEntry] = useState<DailyEntry | null>(null)
  const [tasks, setTasks] = useState<OpenTask[]>([])
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set())
  const [newTaskText, setNewTaskText] = useState('')
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

  const showMessage = useCallback((text: string, duration = 3000) => {
    setMessage(text)
    if (duration > 0) {
      setTimeout(() => setMessage(''), duration)
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      // Load daily entry
      const dailyRes = await fetch(`/api/daily?date=${selectedDate}`)
      if (!dailyRes.ok) {
        console.error('Failed to fetch daily entry:', dailyRes.status)
        setDailyEntry(null)
        setPlanText('')
        setFactText('')
        setTasks([])
        setSelectedTasks(new Set())
      } else {
        const daily = await dailyRes.json()

        if (daily) {
          setDailyEntry(daily)
          setPlanText(daily.planText || '')
          setFactText(daily.factText || '')

          if (daily.planText) {
            const taskList = daily.planText.split('\n').filter((t: string) => t.trim())
            const tasksWithIds: OpenTask[] = taskList.map((text: string, index: number) => ({
              id: index + 1,
              taskText: text,
              taskType: 'operational' as const,
              originDate: selectedDate,
              isClosed: false,
              createdAt: new Date().toISOString()
            }))
            setTasks(tasksWithIds)
          } else {
            setTasks([])
          }

          if (daily.selectedTasksJson) {
            try {
              const selected = JSON.parse(daily.selectedTasksJson) as (string | number)[]
              setSelectedTasks(new Set(selected.map(id => Number(id))))
            } catch {
              setSelectedTasks(new Set())
            }
          } else {
            setSelectedTasks(new Set())
          }
        } else {
          setDailyEntry(null)
          setPlanText('')
          setFactText('')
          setTasks([])
          setSelectedTasks(new Set())
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

      // Если день пустой — автоматически добавляем привычки в задачи
      const dailyCheck = await fetch(`/api/daily?date=${selectedDate}`)
      const dailyData = dailyCheck.ok ? await dailyCheck.json() : null
      const hasPlan = dailyData?.planText && dailyData.planText.trim().length > 0
      
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
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }, [selectedDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  const savePlanWithTasks = useCallback(async (
    taskList: OpenTask[] = tasks,
    selected: Set<number> = selectedTasks
  ) => {
    const planTextToSave = taskList.map(t => t.taskText).join('\n')

    try {
      const res = await fetch('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          planText: planTextToSave,
          selectedTasksJson: JSON.stringify(Array.from(selected)),
        }),
      })

      const data = await res.json()
      setDailyEntry(data)
      setPlanText(planTextToSave)
    } catch (error) {
      console.error('Error saving plan:', error)
      showMessage('❌ Ошибка при сохранении')
    }
  }, [tasks, selectedTasks, selectedDate, showMessage])

  const addTask = useCallback(() => {
    if (!newTaskText.trim()) return
    const newTask: OpenTask = {
      id: Date.now(),
      taskText: newTaskText.trim(),
      taskType: 'operational',
      originDate: selectedDate,
      isClosed: false,
      createdAt: new Date().toISOString()
    }
    const updatedTasks = [...tasks, newTask]
    setTasks(updatedTasks)
    setNewTaskText('')
    savePlanWithTasks(updatedTasks, selectedTasks)
  }, [newTaskText, selectedDate, tasks, selectedTasks, savePlanWithTasks])

  const addGoalToTasks = useCallback((goalText: string) => {
    if (!goalText.trim()) return
    // Проверяем, нет ли уже такой задачи
    if (tasks.some(t => t.taskText === goalText.trim())) {
      showMessage('Эта задача уже добавлена')
      return
    }
    const newTask: OpenTask = {
      id: Date.now(),
      taskText: goalText.trim(),
      taskType: 'operational',
      originDate: selectedDate,
      isClosed: false,
      createdAt: new Date().toISOString()
    }
    const updatedTasks = [...tasks, newTask]
    setTasks(updatedTasks)
    savePlanWithTasks(updatedTasks, selectedTasks)
    showMessage('Цель добавлена в план')
  }, [selectedDate, tasks, selectedTasks, savePlanWithTasks, showMessage])

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

    const maxId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) : 0
    const newTasks: OpenTask[] = newHabitTexts.map((text, index) => ({
      id: maxId + index + 1,
      taskText: text,
      taskType: 'operational' as const,
      originDate: selectedDate,
      isClosed: false,
      createdAt: new Date().toISOString()
    }))

    const updatedTasks = [...tasks, ...newTasks]
    setTasks(updatedTasks)
    savePlanWithTasks(updatedTasks, selectedTasks)
    showMessage(`✅ Добавлено ${newHabitTexts.length} ${newHabitTexts.length === 1 ? 'привычка' : 'привычек'}`)
  }, [selectedDate, tasks, selectedTasks, habits, savePlanWithTasks, showMessage])

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
    const updatedTasks = tasks.filter(t => t.id !== taskId)
    setTasks(updatedTasks)
    const newSelected = new Set(selectedTasks)
    newSelected.delete(taskId)
    setSelectedTasks(newSelected)
    savePlanWithTasks(updatedTasks, newSelected)
  }, [tasks, selectedTasks, savePlanWithTasks])

  const toggleTaskSelection = useCallback((taskId: number) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
    savePlanWithTasks(tasks, newSelected)
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

    const updatedTasks = tasks.map(t =>
      t.id === taskId ? { ...t, taskText: editingTaskText.trim() } : t
    )
    setTasks(updatedTasks)
    setEditingTaskId(null)
    setEditingTaskText('')
    savePlanWithTasks(updatedTasks, selectedTasks)
  }, [editingTaskText, tasks, selectedTasks, savePlanWithTasks])

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

    const newTasks = [...tasks]
    const [draggedTask] = newTasks.splice(draggedIndex, 1)
    newTasks.splice(targetIndex, 0, draggedTask)

    setTasks(newTasks)
    setDraggedTaskId(null)
    savePlanWithTasks(newTasks, selectedTasks)
  }, [draggedTaskId, tasks, selectedTasks, savePlanWithTasks])

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
    if (completedTasks.length === 0) {
      showMessage('❌ Отметьте выполненные задачи перед оценкой')
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
  }, [factText, dailyEntry, tasks, selectedDate, selectedTasks, showMessage])

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
