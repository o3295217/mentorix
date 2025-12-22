'use client'

import { useState, useEffect } from 'react'
import { format, addDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { OpenTask } from '@/lib/types'
import { parseDateParam } from '@/lib/dates'
import { areTasksSimilar } from '@/lib/task-match'

export default function TasksPage() {
  const [openTasks, setOpenTasks] = useState<OpenTask[]>([])
  const [closedTasks, setClosedTasks] = useState<OpenTask[]>([])
  const [showClosed, setShowClosed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  
  // Отслеживание задач в плане: { taskId: date }
  const [tasksInPlan, setTasksInPlan] = useState<Record<number, string>>({})
  
  // Модальное окно выбора даты
  const [showDateModal, setShowDateModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<OpenTask | null>(null)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      const [openRes, closedRes] = await Promise.all([
        fetch('/api/tasks/open'),
        fetch('/api/tasks/closed'),
      ])

      if (openRes.ok) {
        const openData = await openRes.json()
        setOpenTasks(openData)
      }

      if (closedRes.ok) {
        const closedData = await closedRes.json()
        setClosedTasks(closedData)
      }
    } catch (error) {
      console.error('Error loading tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const closeTask = async (taskId: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/close`, { method: 'POST' })
      if (!res.ok) return

      const closedTask = openTasks.find((t) => t.id === taskId)
      if (closedTask) {
        setOpenTasks(openTasks.filter((t) => t.id !== taskId))
        setClosedTasks([{ ...closedTask, isClosed: true, closedAt: new Date().toISOString() }, ...closedTasks])
        // Убираем из "в плане"
        setTasksInPlan(prev => {
          const updated = { ...prev }
          delete updated[taskId]
          return updated
        })
      }
    } catch (error) {
      console.error('Error closing task:', error)
    }
  }

  const reopenTask = async (taskId: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/reopen`, { method: 'POST' })
      if (!res.ok) return

      const reopenedTask = closedTasks.find((t) => t.id === taskId)
      if (reopenedTask) {
        setClosedTasks(closedTasks.filter((t) => t.id !== taskId))
        setOpenTasks([{ ...reopenedTask, isClosed: false, closedAt: undefined }, ...openTasks])
      }
    } catch (error) {
      console.error('Error reopening task:', error)
    }
  }

  // Открыть модальное окно выбора даты
  const openDateModal = (task: OpenTask) => {
    setSelectedTask(task)
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'))
    setShowDateModal(true)
  }

  // Добавить задачу в план на выбранную дату
  const addToPlan = async () => {
    if (!selectedTask) return
    
    try {
      // Получаем текущий план на выбранную дату
      const dailyRes = await fetch(`/api/daily?date=${selectedDate}`)
      const daily = dailyRes.ok ? await dailyRes.json() : null
      
      // Получаем текущие задачи из planText
      const currentPlan = daily?.planText || ''
      const planTasks = currentPlan ? currentPlan.split('\n').filter((t: string) => t.trim()) : []
      
      // Получаем extraTasks для проверки дубликатов
      let currentExtraTasks: string[] = []
      if (daily?.extraTasksJson) {
        try {
          currentExtraTasks = JSON.parse(daily.extraTasksJson)
        } catch {
          currentExtraTasks = []
        }
      }
      
      // Проверяем planText на похожие задачи
      const existsInPlan = planTasks.some((t: string) => areTasksSimilar(t, selectedTask.taskText))
      
      // Проверяем extraTasks на похожие задачи
      const existsInExtra = currentExtraTasks.some(t => areTasksSimilar(t, selectedTask.taskText))
      
      if (existsInPlan || existsInExtra) {
        setMessage('ℹ️ Похожая задача уже есть в плане на этот день')
        setTimeout(() => setMessage(''), 3000)
        setShowDateModal(false)
        return
      }
      
      // Добавляем задачу в основной план (planText)
      const newPlanText = currentPlan 
        ? `${currentPlan}\n${selectedTask.taskText}` 
        : selectedTask.taskText
      
      // Сохраняем обновленный план
      const saveRes = await fetch('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          planText: newPlanText,
        }),
      })
      
      if (saveRes.ok) {
        // Добавляем в отслеживание
        setTasksInPlan(prev => ({ ...prev, [selectedTask.id]: selectedDate }))
        
        const dateLabel = selectedDate === format(new Date(), 'yyyy-MM-dd') 
          ? 'сегодня' 
          : format(parseDateParam(selectedDate), 'd MMM', { locale: ru })
        
        setMessage(`✅ Добавлено в план на ${dateLabel}`)
        setTimeout(() => setMessage(''), 3000)
        setShowDateModal(false)
      }
    } catch (error) {
      console.error('Error adding task to plan:', error)
      setMessage('❌ Ошибка при добавлении в план')
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const strategicOpen = openTasks.filter((t) => t.taskType === 'strategic')
  const operationalOpen = openTasks.filter((t) => t.taskType === 'operational')
  const strategicClosed = closedTasks.filter((t) => t.taskType === 'strategic')
  const operationalClosed = closedTasks.filter((t) => t.taskType === 'operational')

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-600">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Незакрытые задачи</h1>

      {openTasks.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">Все задачи закрыты! 🎉</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strategic Tasks */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4 text-purple-700">🎯 Стратегические задачи</h2>
            {strategicOpen.length === 0 ? (
              <p className="text-gray-600 text-sm">Нет стратегических задач</p>
            ) : (
              <div className="space-y-3">
                {strategicOpen.map((task) => (
                  <div key={task.id} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-gray-800 mb-2">{task.taskText}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {format(parseDateParam(task.originDate), 'd MMM yyyy', { locale: ru })}
                      </span>
                      <div className="flex gap-3 items-center">
                        {tasksInPlan[task.id] ? (
                          <span className="text-green-600 font-medium bg-green-100 px-2 py-0.5 rounded">
                            ✓ в плане {tasksInPlan[task.id] === format(new Date(), 'yyyy-MM-dd') 
                              ? '' 
                              : `(${format(parseDateParam(tasksInPlan[task.id]), 'd MMM', { locale: ru })})`}
                          </span>
                        ) : (
                          <button
                            onClick={() => openDateModal(task)}
                            className="text-green-600 hover:text-green-800 font-medium"
                          >
                            + В план
                          </button>
                        )}
                        <button
                          onClick={() => closeTask(task.id)}
                          className="text-purple-600 hover:text-purple-800 font-medium"
                        >
                          Закрыть
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Operational Tasks */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4 text-blue-700">⚙️ Операционные задачи</h2>
            {operationalOpen.length === 0 ? (
              <p className="text-gray-600 text-sm">Нет операционных задач</p>
            ) : (
              <div className="space-y-3">
                {operationalOpen.map((task) => (
                  <div key={task.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-gray-800 mb-2">{task.taskText}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {format(parseDateParam(task.originDate), 'd MMM yyyy', { locale: ru })}
                      </span>
                      <div className="flex gap-3 items-center">
                        {tasksInPlan[task.id] ? (
                          <span className="text-green-600 font-medium bg-green-100 px-2 py-0.5 rounded">
                            ✓ в плане {tasksInPlan[task.id] === format(new Date(), 'yyyy-MM-dd') 
                              ? '' 
                              : `(${format(parseDateParam(tasksInPlan[task.id]), 'd MMM', { locale: ru })})`}
                          </span>
                        ) : (
                          <button
                            onClick={() => openDateModal(task)}
                            className="text-green-600 hover:text-green-800 font-medium"
                          >
                            + В план
                          </button>
                        )}
                        <button
                          onClick={() => closeTask(task.id)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Закрыть
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Closed Tasks Section */}
      {closedTasks.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowClosed(!showClosed)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium"
          >
            <span className={`transition-transform ${showClosed ? 'rotate-90' : ''}`}>▶</span>
            Закрытые задачи ({closedTasks.length})
          </button>

          {showClosed && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Closed Strategic */}
              <div className="card bg-gray-50">
                <h2 className="text-xl font-bold mb-4 text-gray-500">🎯 Стратегические (закрытые)</h2>
                {strategicClosed.length === 0 ? (
                  <p className="text-gray-500 text-sm">Нет закрытых стратегических задач</p>
                ) : (
                  <div className="space-y-3">
                    {strategicClosed.map((task) => (
                      <div key={task.id} className="p-4 bg-white rounded-lg border border-gray-200">
                        <p className="text-gray-500 line-through mb-2">{task.taskText}</p>
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-gray-500">
                            {task.closedAt && format(new Date(task.closedAt), 'd MMM yyyy', { locale: ru })}
                          </div>
                          <button
                            onClick={() => reopenTask(task.id)}
                            className="text-green-600 hover:text-green-800 font-medium"
                          >
                            ↩ Вернуть
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Closed Operational */}
              <div className="card bg-gray-50">
                <h2 className="text-xl font-bold mb-4 text-gray-500">⚙️ Операционные (закрытые)</h2>
                {operationalClosed.length === 0 ? (
                  <p className="text-gray-500 text-sm">Нет закрытых операционных задач</p>
                ) : (
                  <div className="space-y-3">
                    {operationalClosed.map((task) => (
                      <div key={task.id} className="p-4 bg-white rounded-lg border border-gray-200">
                        <p className="text-gray-500 line-through mb-2">{task.taskText}</p>
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-gray-500">
                            {task.closedAt && format(new Date(task.closedAt), 'd MMM yyyy', { locale: ru })}
                          </div>
                          <button
                            onClick={() => reopenTask(task.id)}
                            className="text-green-600 hover:text-green-800 font-medium"
                          >
                            ↩ Вернуть
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {message && (
        <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 border border-gray-200 z-50">
          <p className="font-medium">{message}</p>
        </div>
      )}

      {/* Модальное окно выбора даты */}
      {showDateModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-xl font-bold mb-4">📅 Добавить в план</h3>
            
            <p className="text-gray-600 text-sm mb-4 line-clamp-2">
              {selectedTask.taskText}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">На какой день?</label>
              
              {/* Быстрые кнопки */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedDate === format(new Date(), 'yyyy-MM-dd')
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Сегодня
                </button>
                <button
                  onClick={() => setSelectedDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedDate === format(addDays(new Date(), 1), 'yyyy-MM-dd')
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Завтра
                </button>
              </div>

              {/* Календарь */}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={addToPlan}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
