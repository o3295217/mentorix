'use client'

import { useState } from 'react'
import { format, addDays } from 'date-fns'
import { ru } from 'date-fns/locale'

export interface UncompletedTask {
  id: number
  taskText: string
  transferCount?: number // сколько раз уже переносилась
}

export type TaskAction = 
  | { type: 'transfer'; date: string }
  | { type: 'backlog' }
  | { type: 'completed' }
  | { type: 'skip' }

export interface TaskDecision {
  taskId: number
  taskText: string
  action: TaskAction
}

interface Props {
  tasks: UncompletedTask[]
  currentDate: string
  onComplete: (decisions: TaskDecision[]) => void
  onCancel: () => void
}

export default function UncompletedTasksModal({ tasks, currentDate, onComplete, onCancel }: Props) {
  const [decisions, setDecisions] = useState<Record<number, TaskAction>>({})
  const [expandedTask, setExpandedTask] = useState<number | null>(null)
  const [customDate, setCustomDate] = useState<Record<number, string>>({})

  const tomorrow = format(addDays(new Date(currentDate), 1), 'yyyy-MM-dd')

  const setAction = (taskId: number, action: TaskAction) => {
    setDecisions(prev => ({ ...prev, [taskId]: action }))
    setExpandedTask(null)
  }

  const handleSubmit = () => {
    const result: TaskDecision[] = tasks.map(task => ({
      taskId: task.id,
      taskText: task.taskText,
      action: decisions[task.id] || { type: 'skip' }
    }))
    onComplete(result)
  }

  const handleTransferAll = () => {
    const newDecisions: Record<number, TaskAction> = {}
    tasks.forEach(task => {
      newDecisions[task.id] = { type: 'transfer', date: tomorrow }
    })
    setDecisions(newDecisions)
  }

  const getActionLabel = (action: TaskAction | undefined) => {
    if (!action) return '—'
    switch (action.type) {
      case 'transfer': return `→ ${format(new Date(action.date), 'd MMM', { locale: ru })}`
      case 'backlog': return '📋 В задачи'
      case 'completed': return '✅ Выполнено'
      case 'skip': return '⏭️ Пропустить'
    }
  }

  const allDecided = tasks.every(t => decisions[t.id])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            📝 Невыполненные задачи
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Что делать с задачами, которые не были выполнены?
          </p>
        </div>

        {/* Quick actions */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <button
            onClick={handleTransferAll}
            className="text-sm px-3 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition"
          >
            📅 Все на завтра
          </button>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tasks.map(task => (
            <div 
              key={task.id}
              className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 dark:text-white text-sm">
                    {task.taskText}
                  </p>
                  {task.transferCount && task.transferCount >= 3 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      ⚠️ Переносится {task.transferCount}-й раз. Может разбить на шаги?
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {getActionLabel(decisions[task.id])}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => setAction(task.id, { type: 'transfer', date: tomorrow })}
                  className={`text-xs px-2 py-1 rounded transition ${
                    decisions[task.id]?.type === 'transfer' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                >
                  📅 Завтра
                </button>
                
                <button
                  onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                  className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 transition"
                >
                  📆 Другая дата
                </button>

                <button
                  onClick={() => setAction(task.id, { type: 'backlog' })}
                  className={`text-xs px-2 py-1 rounded transition ${
                    decisions[task.id]?.type === 'backlog' 
                      ? 'bg-purple-500 text-white' 
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                >
                  📋 В задачи
                </button>

                <button
                  onClick={() => setAction(task.id, { type: 'completed' })}
                  className={`text-xs px-2 py-1 rounded transition ${
                    decisions[task.id]?.type === 'completed' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                >
                  ✅ Выполнено
                </button>

                <button
                  onClick={() => setAction(task.id, { type: 'skip' })}
                  className={`text-xs px-2 py-1 rounded transition ${
                    decisions[task.id]?.type === 'skip' 
                      ? 'bg-gray-500 text-white' 
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                >
                  ⏭️ Пропустить
                </button>
              </div>

              {/* Date picker */}
              {expandedTask === task.id && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="date"
                    value={customDate[task.id] || tomorrow}
                    onChange={(e) => setCustomDate(prev => ({ ...prev, [task.id]: e.target.value }))}
                    min={tomorrow}
                    className="text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={() => {
                      setAction(task.id, { type: 'transfer', date: customDate[task.id] || tomorrow })
                    }}
                    className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                  >
                    Выбрать
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition"
          >
            Отмена
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {Object.keys(decisions).length}/{tasks.length} задач
            </span>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Продолжить оценку
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
