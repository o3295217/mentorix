'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { getPeriodDates } from '@/lib/dates'
import DatePickerWithIndicators from '@/components/DatePickerWithIndicators'
import { DailyEntry, PeriodGoals, OpenTask } from '@/lib/types'

export default function DailyPage() {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [planText, setPlanText] = useState('')
  const [factText, setFactText] = useState('')
  const [weekGoals, setWeekGoals] = useState<string[]>([])
  const [monthGoals, setMonthGoals] = useState<string[]>([])
  const [dailyEntry, setDailyEntry] = useState<DailyEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set())
  const [tasks, setTasks] = useState<OpenTask[]>([])
  const [newTaskText, setNewTaskText] = useState('')
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editingTaskText, setEditingTaskText] = useState('')

  useEffect(() => {
    loadData()
  }, [selectedDate])

  // Восстановить высоту textarea при загрузке (только один раз)
  useEffect(() => {
    // Небольшая задержка чтобы дать время DOM отрендериться
    const timeoutId = setTimeout(() => {
      const textareas = document.querySelectorAll('textarea')
      textareas.forEach((textarea: Element) => {
        const el = textarea as HTMLTextAreaElement
        el.style.height = 'auto'
        el.style.height = el.scrollHeight + 'px'
      })
    }, 100)
    
    return () => clearTimeout(timeoutId)
  }, [selectedDate]) // Только при смене даты, не при каждом изменении planText

  const loadData = async () => {
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

          // Загрузить задачи из planText с генерацией ID
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

          // Восстановить выбранные задачи
          if (daily.selectedTasksJson) {
            try {
              const selected = JSON.parse(daily.selectedTasksJson) as (string | number)[]
              setSelectedTasks(new Set(selected.map(id => Number(id))))
            } catch (e) {
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
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const addTask = () => {
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
    // Автоматически сохраняем
    savePlanWithTasks(updatedTasks)
  }

  const removeTask = (taskId: number) => {
    const updatedTasks = tasks.filter(t => t.id !== taskId)
    setTasks(updatedTasks)
    // Убираем из выбранных если была выбрана
    const newSelected = new Set(selectedTasks)
    newSelected.delete(taskId)
    setSelectedTasks(newSelected)
    // Автоматически сохраняем
    savePlanWithTasks(updatedTasks, newSelected)
  }

  const savePlanWithTasks = async (
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
      setMessage('❌ Ошибка при сохранении')
    }
  }

  const savePlan = async () => {
    setSaving(true)
    setMessage('')
    await savePlanWithTasks()
    setMessage('✅ План сохранен!')
    setTimeout(() => setMessage(''), 3000)
    setSaving(false)
  }

  const saveFact = async () => {
    setSaving(true)
    setMessage('')

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
      setMessage('✅ Факт сохранен!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Error saving fact:', error)
      setMessage('❌ Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  const transferCompletedTasks = async () => {
    if (selectedTasks.size === 0) {
      setMessage('ℹ️ Выберите задачи для переноса')
      setTimeout(() => setMessage(''), 2000)
      return
    }

    const tasksToTransfer: string[] = []
    tasks.forEach((task) => {
      if (selectedTasks.has(task.id)) {
        tasksToTransfer.push(task.taskText)
      }
    })

    // Добавляем выбранные задачи в факт
    const currentFact = factText.trim()
    const newFact = currentFact
      ? `${currentFact}\n${tasksToTransfer.join('\n')}`
      : tasksToTransfer.join('\n')
    setFactText(newFact)

    setMessage(`✅ Перенесено ${tasksToTransfer.length} ${tasksToTransfer.length === 1 ? 'задача' : tasksToTransfer.length < 5 ? 'задачи' : 'задач'}`)
    setTimeout(() => setMessage(''), 3000)
  }

  const toggleTaskSelection = (taskId: number) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
    // Автоматически сохраняем
    savePlanWithTasks(tasks, newSelected)
  }

  const handleDragStart = (taskId: number) => {
    setDraggedTaskId(taskId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (targetTaskId: number) => {
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
  }

  const startEditingTask = (taskId: number, currentText: string) => {
    setEditingTaskId(taskId)
    setEditingTaskText(currentText)
  }

  const saveEditedTask = (taskId: number) => {
    if (!editingTaskText.trim()) {
      // Если текст пустой, отменяем редактирование
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
  }

  const cancelEditingTask = () => {
    setEditingTaskId(null)
    setEditingTaskText('')
  }

  const evaluate = async () => {
    if (!factText) {
      setMessage('❌ Добавьте факт выполнения перед оценкой')
      return
    }

    setEvaluating(true)
    setMessage('⏳ Получение оценки от ИИ...')

    try {
      // Если нет dailyEntry, сначала сохраняем и получаем актуальный ID
      let entryId = dailyEntry?.id

      if (!entryId) {
        // Сохраняем план и факт, получаем ID из ответа
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
          setMessage('❌ Ошибка при сохранении данных')
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
        setMessage('✅ Оценка получена!')
        setTimeout(() => {
          router.push(`/evaluation/${selectedDate}`)
        }, 1000)
      } else {
        const error = await res.json()
        setMessage(`❌ Ошибка: ${error.error}`)
      }
    } catch (error) {
      console.error('Error evaluating:', error)
      setMessage('❌ Ошибка при получении оценки')
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Ежедневное планирование</h1>
        <DatePickerWithIndicators value={selectedDate} onChange={setSelectedDate} />
      </div>

      <p className="text-lg text-gray-600">
        {format(new Date(selectedDate), 'd MMMM yyyy, EEEE', { locale: ru })}
      </p>

      {/* Context from periods */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card bg-blue-50 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3">📌 Цели текущей недели:</h3>
          {weekGoals.length > 0 ? (
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              {weekGoals.map((goal, i) => (
                <li key={i}>{goal}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-blue-600">Не установлены</p>
          )}
        </div>

        <div className="card bg-purple-50 border border-purple-200">
          <h3 className="font-semibold text-purple-900 mb-3">📋 Цели текущего месяца:</h3>
          {monthGoals.length > 0 ? (
            <ul className="text-sm text-purple-800 space-y-1 list-disc list-inside">
              {monthGoals.map((goal, i) => (
                <li key={i}>{goal}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-purple-600">Не установлены</p>
          )}
        </div>
      </div>

      {/* Plan and Fact side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan - Left */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">📝 План на день</h2>
            <button
              onClick={transferCompletedTasks}
              className="text-sm bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1 rounded border border-green-300 transition-colors"
              title="Перенести выбранные задачи в факт"
            >
              ➡️ Перенести выбранные
            </button>
          </div>

          {/* Добавление новой задачи */}
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTask()
                }
              }}
              placeholder="Добавить задачу..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={addTask}
              className="btn-primary"
            >
              Добавить
            </button>
          </div>

          {/* Список задач */}
          <div className="space-y-2 mb-4">
            {tasks.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">
                Добавьте задачи на день...
              </p>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  draggable={editingTaskId !== task.id}
                  onDragStart={() => handleDragStart(task.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(task.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                    editingTaskId === task.id ? 'cursor-text' : 'cursor-move'
                  } ${
                    selectedTasks.has(task.id)
                      ? 'bg-green-50 border-green-300'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  } ${draggedTaskId === task.id ? 'opacity-50' : ''}`}
                >
                  <span className="text-gray-400 cursor-grab active:cursor-grabbing">⋮⋮</span>
                  <input
                    type="checkbox"
                    checked={selectedTasks.has(task.id)}
                    onChange={() => toggleTaskSelection(task.id)}
                    className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500 flex-shrink-0"
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
                      className="flex-1 px-2 py-1 text-sm border border-primary-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  ) : (
                    <span
                      className={`flex-1 text-sm ${selectedTasks.has(task.id) ? 'line-through text-gray-500' : ''}`}
                      onDoubleClick={() => startEditingTask(task.id, task.taskText)}
                      title="Дважды кликните для редактирования"
                    >
                      {task.taskText}
                    </span>
                  )}

                  <button
                    onClick={() => removeTask(task.id)}
                    className="text-red-500 hover:text-red-700 text-sm px-2 py-1"
                    title="Удалить задачу"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          <button onClick={savePlan} disabled={saving} className="btn-primary disabled:opacity-50 w-full">
            {saving ? 'Сохранение...' : 'Сохранить план'}
          </button>
        </div>

        {/* Fact - Right */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">✅ Факт выполнения</h2>
          <textarea
            value={factText}
            onChange={(e) => setFactText(e.target.value)}
            className="textarea"
            placeholder="Введите что реально сделали за день...&#10;&#10;Например:&#10;1. ИИ ассистент - не сделал&#10;2. Калькулятор - готов&#10;3. Штатное расписание - не сделал"
            rows={12}
          />
          <button onClick={saveFact} disabled={saving} className="btn-primary w-full disabled:opacity-50">
            {saving ? 'Сохранение...' : 'Сохранить факт'}
          </button>
        </div>
      </div>

      {/* Evaluate */}
      <div className="card bg-gradient-to-r from-primary-50 to-purple-50 border border-primary-200">
        <h2 className="text-xl font-bold mb-4">🤖 Получить оценку от ИИ</h2>
        <p className="text-gray-700 mb-4">
          После заполнения плана и факта, получите детальную оценку и обратную связь от ИИ-ассистента.
        </p>
        <button
          onClick={evaluate}
          disabled={evaluating || !factText}
          className="btn-primary disabled:opacity-50"
        >
          {evaluating ? 'Получение оценки...' : 'Получить оценку'}
        </button>
        {dailyEntry?.evaluation && (
          <p className="mt-4 text-sm text-green-700">
            ✅ Оценка за этот день уже получена. Вы можете получить новую оценку.
          </p>
        )}
      </div>

      {message && (
        <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 border border-gray-200">
          <p className="font-medium">{message}</p>
        </div>
      )}
    </div>
  )
}
