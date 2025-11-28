'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { getPeriodDates } from '@/lib/dates'
import DatePickerWithIndicators from '@/components/DatePickerWithIndicators'

export default function DailyPage() {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [planText, setPlanText] = useState('')
  const [factText, setFactText] = useState('')
  const [weekGoals, setWeekGoals] = useState<string[]>([])
  const [monthGoals, setMonthGoals] = useState<string[]>([])
  const [dailyEntry, setDailyEntry] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set())
  const [tasks, setTasks] = useState<string[]>([])
  const [newTaskText, setNewTaskText] = useState('')

  useEffect(() => {
    loadData()
  }, [selectedDate])

  // Восстановить высоту textarea при загрузке (только один раз)
  useEffect(() => {
    // Небольшая задержка чтобы дать время DOM отрендериться
    setTimeout(() => {
      const textareas = document.querySelectorAll('textarea')
      textareas.forEach((textarea: Element) => {
        const el = textarea as HTMLTextAreaElement
        el.style.height = 'auto'
        el.style.height = el.scrollHeight + 'px'
      })
    }, 100)
  }, [selectedDate]) // Только при смене даты, не при каждом изменении planText

  const loadData = async () => {
    try {
      // Load daily entry
      const dailyRes = await fetch(`/api/daily?date=${selectedDate}`)
      const daily = await dailyRes.json()

      if (daily) {
        setDailyEntry(daily)
        setPlanText(daily.planText || '')
        setFactText(daily.factText || '')

        // Загрузить задачи из planText
        if (daily.planText) {
          const taskList = daily.planText.split('\n').filter((t: string) => t.trim())
          setTasks(taskList)
        } else {
          setTasks([])
        }

        // Восстановить выбранные задачи
        if (daily.selectedTasksJson) {
          try {
            const selected = JSON.parse(daily.selectedTasksJson) as number[]
            setSelectedTasks(new Set(selected))
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

      // Load week goals
      const date = new Date(selectedDate)
      const { start: weekStart } = getPeriodDates(date, 'week')
      const weekRes = await fetch(`/api/goals/period?type=week&date=${weekStart.toISOString()}`)
      const weekData = await weekRes.json()
      setWeekGoals(weekData?.goals || [])

      // Load month goals
      const { start: monthStart } = getPeriodDates(date, 'month')
      const monthRes = await fetch(`/api/goals/period?type=month&date=${monthStart.toISOString()}`)
      const monthData = await monthRes.json()
      setMonthGoals(monthData?.goals || [])
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const addTask = () => {
    if (!newTaskText.trim()) return
    const updatedTasks = [...tasks, newTaskText.trim()]
    setTasks(updatedTasks)
    setNewTaskText('')
    // Автоматически сохраняем
    savePlanWithTasks(updatedTasks)
  }

  const removeTask = (index: number) => {
    const updatedTasks = tasks.filter((_, i) => i !== index)
    setTasks(updatedTasks)
    // Убираем из выбранных если была выбрана
    const newSelected = new Set(selectedTasks)
    newSelected.delete(index)
    setSelectedTasks(newSelected)
    // Автоматически сохраняем
    savePlanWithTasks(updatedTasks, newSelected)
  }

  const savePlanWithTasks = async (taskList: string[] = tasks, selected: Set<number> = selectedTasks) => {
    const planTextToSave = taskList.join('\n')

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
    tasks.forEach((task, index) => {
      if (selectedTasks.has(index)) {
        tasksToTransfer.push(task)
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

  const toggleTaskSelection = (index: number) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedTasks(newSelected)
    // Автоматически сохраняем
    savePlanWithTasks(tasks, newSelected)
  }

  const evaluate = async () => {
    if (!dailyEntry?.id) {
      setMessage('❌ Сначала сохраните план и факт')
      return
    }

    if (!factText) {
      setMessage('❌ Добавьте факт выполнения перед оценкой')
      return
    }

    setEvaluating(true)
    setMessage('⏳ Получение оценки от ИИ...')

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyEntryId: dailyEntry.id,
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
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addTask}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
              tasks.map((task, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                    selectedTasks.has(index)
                      ? 'bg-green-50 border-green-300'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTasks.has(index)}
                    onChange={() => toggleTaskSelection(index)}
                    className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500 flex-shrink-0"
                  />
                  <span className={`flex-1 text-sm ${selectedTasks.has(index) ? 'line-through text-gray-500' : ''}`}>
                    {task}
                  </span>
                  <button
                    onClick={() => removeTask(index)}
                    className="text-red-500 hover:text-red-700 text-sm px-2 py-1"
                    title="Удалить задачу"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
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
          <button onClick={saveFact} disabled={saving} className="btn-primary mt-4 disabled:opacity-50">
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
