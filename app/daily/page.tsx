'use client'

import { useEffect } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { useDaily } from '@/hooks/useDaily'
import DatePickerWithIndicators from '@/components/DatePickerWithIndicators'

export default function DailyPage() {
  const router = useRouter()
  const {
    selectedDate,
    setSelectedDate,
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
  } = useDaily()

  // Восстановить высоту textarea при загрузке
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const textareas = document.querySelectorAll('textarea')
      textareas.forEach((textarea: Element) => {
        const el = textarea as HTMLTextAreaElement
        el.style.height = 'auto'
        el.style.height = el.scrollHeight + 'px'
      })
    }, 100)
    
    return () => clearTimeout(timeoutId)
  }, [selectedDate])

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
          <h3 className="font-semibold text-blue-900 mb-3">🎯 Цели текущей недели:</h3>
          {weekGoals.length > 0 ? (
            <ul className="text-sm text-blue-800 space-y-1">
              {weekGoals.map((goal, index) => (
                <li key={index} className="flex items-start gap-2 group">
                  <span className="mt-1">•</span>
                  <span className="flex-1">{goal}</span>
                  <button
                    onClick={() => addGoalToTasks(goal)}
                    className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800 transition-opacity text-xs px-2 py-0.5 bg-blue-100 hover:bg-blue-200 rounded"
                    title="Добавить в план"
                  >
                    → в план
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-blue-600">Не установлены</p>
          )}
        </div>

        <div className="card bg-purple-50 border border-purple-200">
          <h3 className="font-semibold text-purple-900 mb-3">📋 Цели текущего месяца:</h3>
          {monthGoals.length > 0 ? (
            <ul className="text-sm text-purple-800 space-y-1">
              {monthGoals.map((goal, index) => (
                <li key={index} className="flex items-start gap-2 group">
                  <span className="mt-1">•</span>
                  <span className="flex-1">{goal}</span>
                  <button
                    onClick={() => addGoalToTasks(goal)}
                    className="opacity-0 group-hover:opacity-100 text-purple-600 hover:text-purple-800 transition-opacity text-xs px-2 py-0.5 bg-purple-100 hover:bg-purple-200 rounded"
                    title="Добавить в план"
                  >
                    → в план
                  </button>
                </li>
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
          onClick={() => evaluate(router)}
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
