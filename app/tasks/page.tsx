'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { OpenTask } from '@/lib/types'

export default function TasksPage() {
  const [openTasks, setOpenTasks] = useState<OpenTask[]>([])
  const [closedTasks, setClosedTasks] = useState<OpenTask[]>([])
  const [showClosed, setShowClosed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

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

  const addToPlan = async (task: OpenTask) => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      
      // Получаем текущий план на сегодня
      const dailyRes = await fetch(`/api/daily?date=${today}`)
      const daily = dailyRes.ok ? await dailyRes.json() : null
      
      // Добавляем задачу к плану
      const currentPlan = daily?.planText || ''
      const newPlan = currentPlan ? `${currentPlan}\n${task.taskText}` : task.taskText
      
      // Сохраняем обновленный план
      const saveRes = await fetch('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          planText: newPlan,
        }),
      })
      
      if (saveRes.ok) {
        setMessage(`✅ "${task.taskText.substring(0, 30)}..." добавлено в план`)
        setTimeout(() => setMessage(''), 3000)
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
                        {format(new Date(task.originDate), 'd MMM yyyy', { locale: ru })}
                      </span>
                      <div className="flex gap-3">
                        <button
                          onClick={() => addToPlan(task)}
                          className="text-green-600 hover:text-green-800 font-medium"
                        >
                          + В план
                        </button>
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
                        {format(new Date(task.originDate), 'd MMM yyyy', { locale: ru })}
                      </span>
                      <div className="flex gap-3">
                        <button
                          onClick={() => addToPlan(task)}
                          className="text-green-600 hover:text-green-800 font-medium"
                        >
                          + В план
                        </button>
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
    </div>
  )
}
