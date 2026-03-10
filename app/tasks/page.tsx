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
  
  // Скрывать задачи которые уже в плане на сегодня
  const [hideInPlan, setHideInPlan] = useState(true)
  
  // Модальное окно выбора даты
  const [showDateModal, setShowDateModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<OpenTask | null>(null)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  
  // Inline-подтверждение удаления
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  
  // Inline-подтверждение закрытия
  const [confirmCloseId, setConfirmCloseId] = useState<number | null>(null)

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      
      const [openRes, closedRes, dailyRes] = await Promise.all([
        fetch('/api/tasks/open'),
        fetch('/api/tasks/closed'),
        fetch(`/api/daily?date=${today}`),
      ])

      let openData: OpenTask[] = []
      if (openRes.ok) {
        openData = await openRes.json()
        setOpenTasks(openData)
      }

      if (closedRes.ok) {
        const closedData = await closedRes.json()
        setClosedTasks(closedData)
      }

      // Проверяем какие задачи уже в плане на сегодня
      if (dailyRes.ok && openData.length > 0) {
        const daily = await dailyRes.json()
        const planText = daily?.planText || ''
        const planTasks = planText.split('\n').filter((t: string) => t.trim())
        
        let extraTasks: string[] = []
        if (daily?.extraTasksJson) {
          try {
            extraTasks = JSON.parse(daily.extraTasksJson)
          } catch {
            extraTasks = []
          }
        }
        
        const allPlanTasks = [...planTasks, ...extraTasks]
        
        // Находим задачи которые уже в плане
        const inPlanMap: Record<number, string> = {}
        for (const task of openData) {
          const isInPlan = allPlanTasks.some((planTask: string) => 
            areTasksSimilar(task.taskText, planTask)
          )
          if (isInPlan) {
            inPlanMap[task.id] = today
          }
        }
        setTasksInPlan(inPlanMap)
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

  // Удалить задачу полностью
  const deleteTask = async (taskId: number, isClosed: boolean = false) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/delete`, { method: 'DELETE' })
      if (!res.ok) return

      if (isClosed) {
        setClosedTasks(closedTasks.filter((t) => t.id !== taskId))
      } else {
        setOpenTasks(openTasks.filter((t) => t.id !== taskId))
      }
      // Убираем из "в плане"
      setTasksInPlan(prev => {
        const updated = { ...prev }
        delete updated[taskId]
        return updated
      })
      setMessage('Задача удалена')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Error deleting task:', error)
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
        setMessage('Похожая задача уже есть в плане на этот день')
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
        
        setMessage(`Добавлено в план на ${dateLabel}`)
        setTimeout(() => setMessage(''), 3000)
        setShowDateModal(false)
      }
    } catch (error) {
      console.error('Error adding task to plan:', error)
      setMessage('Ошибка при добавлении в план')
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const today = format(new Date(), 'yyyy-MM-dd')
  const inPlanTodayCount = Object.values(tasksInPlan).filter(d => d === today).length
  
  // Фильтруем задачи которые в плане на сегодня (если включено скрытие)
  const filteredOpen = hideInPlan 
    ? openTasks.filter(t => tasksInPlan[t.id] !== today)
    : openTasks
  
  const strategicOpen = filteredOpen.filter((t) => t.taskType === 'strategic')
  const operationalOpen = filteredOpen.filter((t) => t.taskType === 'operational')
  const strategicClosed = closedTasks.filter((t) => t.taskType === 'strategic')
  const operationalClosed = closedTasks.filter((t) => t.taskType === 'operational')

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-400">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Незакрытые задачи</h1>
        {inPlanTodayCount > 0 && (
          <button
            onClick={() => setHideInPlan(!hideInPlan)}
            className="px-3 py-1.5 rounded-lg transition bg-blue-900/30 text-blue-300 hover:bg-blue-900/50"
          >
            {hideInPlan 
              ? `Показать в плане (${inPlanTodayCount})` 
              : `Скрыть в плане (${inPlanTodayCount})`}
          </button>
        )}
      </div>

      {openTasks.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">Все задачи закрыты!</p>
        </div>
      ) : filteredOpen.length === 0 && hideInPlan ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">
            Все задачи добавлены в план на сегодня
          </p>
          <button
            onClick={() => setHideInPlan(false)}
            className="mt-3 text-sm text-blue-400 hover:underline"
          >
            Показать {inPlanTodayCount} задач в плане
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strategic Tasks */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4 text-purple-400">Стратегические задачи</h2>
            {strategicOpen.length === 0 ? (
              <p className="text-gray-400 text-sm">Нет стратегических задач</p>
            ) : (
              <div className="space-y-3">
                {strategicOpen.map((task) => (
                  <div key={task.id} className="p-4 bg-purple-900/30 rounded-lg border border-purple-700">
                    <p className="text-gray-200 mb-2">{task.taskText}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">
                        {format(parseDateParam(task.originDate), 'd MMM yyyy', { locale: ru })}
                      </span>
                      <div className="flex gap-3 items-center">
                        {tasksInPlan[task.id] ? (
                          <span className="text-green-400 font-medium px-2 py-0.5 rounded bg-green-900/50">
                             в плане {tasksInPlan[task.id] === format(new Date(), 'yyyy-MM-dd') 
                              ? '' 
                              : `(${format(parseDateParam(tasksInPlan[task.id]), 'd MMM', { locale: ru })})`}
                          </span>
                        ) : (
                          <button
                            onClick={() => openDateModal(task)}
                            className="text-green-400 font-medium hover:text-green-300"
                          >
                            + В план
                          </button>
                        )}
                        {confirmCloseId === task.id ? (
                          <div className="flex items-center gap-1 rounded px-2 py-0.5 bg-green-900/50">
                            <span className="text-green-300">Задача выполнена?</span>
                            <button
                              onClick={() => {
                                closeTask(task.id)
                                setConfirmCloseId(null)
                              }}
                              className="w-5 h-5 flex items-center justify-center text-green-400 rounded text-xs hover:bg-green-800"
                            >
                              Да
                            </button>
                            <button
                              onClick={() => setConfirmCloseId(null)}
                              className="w-5 h-5 flex items-center justify-center text-gray-500 hover:bg-gray-700 rounded text-xs"
                            >
                              Нет
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmCloseId(task.id)}
                            className="text-purple-400 font-medium hover:text-purple-300"
                          >
                            Закрыть
                          </button>
                        )}
                        {confirmDeleteId === task.id ? (
                          <div className="flex items-center gap-1 rounded px-2 py-0.5 bg-red-900/50">
                            <span className="text-red-300">Удалить?</span>
                            <button
                              onClick={() => {
                                deleteTask(task.id)
                                setConfirmDeleteId(null)
                              }}
                              className="w-5 h-5 flex items-center justify-center text-green-400 rounded text-xs hover:bg-green-800"
                            >
                              
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="w-5 h-5 flex items-center justify-center text-gray-500 hover:bg-gray-700 rounded text-xs"
                            >
                              
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(task.id)}
                            className="text-red-500 hover:text-red-400 font-medium"
                          >
                            Удалить
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Operational Tasks */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4 text-blue-400">Операционные задачи</h2>
            {operationalOpen.length === 0 ? (
              <p className="text-gray-400 text-sm">Нет операционных задач</p>
            ) : (
              <div className="space-y-3">
                {operationalOpen.map((task) => (
                  <div key={task.id} className="p-4 bg-blue-900/30 rounded-lg border border-blue-700">
                    <p className="text-gray-200 mb-2">{task.taskText}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">
                        {format(parseDateParam(task.originDate), 'd MMM yyyy', { locale: ru })}
                      </span>
                      <div className="flex gap-3 items-center">
                        {tasksInPlan[task.id] ? (
                          <span className="text-green-400 font-medium px-2 py-0.5 rounded bg-green-900/50">
                             в плане {tasksInPlan[task.id] === format(new Date(), 'yyyy-MM-dd') 
                              ? '' 
                              : `(${format(parseDateParam(tasksInPlan[task.id]), 'd MMM', { locale: ru })})`}
                          </span>
                        ) : (
                          <button
                            onClick={() => openDateModal(task)}
                            className="text-green-400 hover:text-green-300 font-medium"
                          >
                            + В план
                          </button>
                        )}
                        {confirmCloseId === task.id ? (
                          <div className="flex items-center gap-1 rounded px-2 py-0.5 bg-green-900/50">
                            <span className="text-green-300">Задача выполнена?</span>
                            <button
                              onClick={() => {
                                closeTask(task.id)
                                setConfirmCloseId(null)
                              }}
                              className="w-5 h-5 flex items-center justify-center text-green-400 rounded text-xs hover:bg-green-800"
                            >
                              Да
                            </button>
                            <button
                              onClick={() => setConfirmCloseId(null)}
                              className="w-5 h-5 flex items-center justify-center text-gray-500 hover:bg-gray-700 rounded text-xs"
                            >
                              Нет
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmCloseId(task.id)}
                            className="text-blue-400 hover:text-blue-300 font-medium"
                          >
                            Закрыть
                          </button>
                        )}
                        {confirmDeleteId === task.id ? (
                          <div className="flex items-center gap-1 rounded px-2 py-0.5 bg-red-900/50">
                            <span className="text-red-300">Удалить?</span>
                            <button
                              onClick={() => {
                                deleteTask(task.id)
                                setConfirmDeleteId(null)
                              }}
                              className="w-5 h-5 flex items-center justify-center text-green-400 rounded text-xs hover:bg-green-800"
                            >
                              
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="w-5 h-5 flex items-center justify-center text-gray-500 hover:bg-gray-700 rounded text-xs"
                            >
                              
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(task.id)}
                            className="text-red-500 hover:text-red-400 font-medium"
                          >
                            Удалить
                          </button>
                        )}
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
            className="flex items-center gap-2 text-gray-400 font-medium hover:text-gray-200"
          >
            
            Закрытые задачи ({closedTasks.length})
          </button>

          {showClosed && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Closed Strategic */}
              <div className="card bg-gray-900/80">
                <h2 className="text-xl font-bold mb-4 text-gray-400">Стратегические (закрытые)</h2>
                {strategicClosed.length === 0 ? (
                  <p className="text-gray-400 text-sm">Нет закрытых стратегических задач</p>
                ) : (
                  <div className="space-y-3">
                    {strategicClosed.map((task) => (
                      <div key={task.id} className="p-4 rounded-lg border border-gray-700 bg-gray-800/50">
                        <p className="text-gray-400 line-through mb-2">{task.taskText}</p>
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-gray-400">
                            {task.closedAt && format(new Date(task.closedAt), 'd MMM yyyy', { locale: ru })}
                          </div>
                          <button
                            onClick={() => reopenTask(task.id)}
                            className="text-green-400 hover:text-green-300 font-medium"
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
              <div className="card bg-gray-900/80">
                <h2 className="text-xl font-bold mb-4 text-gray-400">Операционные (закрытые)</h2>
                {operationalClosed.length === 0 ? (
                  <p className="text-gray-400 text-sm">Нет закрытых операционных задач</p>
                ) : (
                  <div className="space-y-3">
                    {operationalClosed.map((task) => (
                      <div key={task.id} className="p-4 rounded-lg border border-gray-700 bg-gray-800/50">
                        <p className="text-gray-400 line-through mb-2">{task.taskText}</p>
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-gray-400">
                            {task.closedAt && format(new Date(task.closedAt), 'd MMM yyyy', { locale: ru })}
                          </div>
                          <button
                            onClick={() => reopenTask(task.id)}
                            className="text-green-400 hover:text-green-300 font-medium"
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
        <div className="fixed bottom-4 right-4 bg-gray-900/80 shadow-lg rounded-lg p-4 border border-gray-700 z-50">
          <p className="font-medium text-gray-100">{message}</p>
        </div>
      )}

      {/* Модальное окно выбора даты */}
      {showDateModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900/80 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-xl font-bold mb-4 text-gray-100"> Добавить в план</h3>
            
            <p className="text-gray-400 text-sm mb-4 line-clamp-2">
              {selectedTask.taskText}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">На какой день?</label>
              
              {/* Быстрые кнопки */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedDate === format(new Date(), 'yyyy-MM-dd')
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Сегодня
                </button>
                <button
                  onClick={() => setSelectedDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedDate === format(addDays(new Date(), 1), 'yyyy-MM-dd')
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
                className="w-full px-3 py-2 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-100 bg-gray-700"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-700 text-gray-300 transition-colors"
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
