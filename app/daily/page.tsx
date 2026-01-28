'use client'

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { useDaily } from '@/hooks/useDaily'
import DatePickerWithIndicators from '@/components/DatePickerWithIndicators'
import UncompletedTasksModal, { TaskDecision, UncompletedTask } from '@/components/UncompletedTasksModal'

type FrequencyType = 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'custom'

export default function DailyPage() {
  const router = useRouter()
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [showUncompletedModal, setShowUncompletedModal] = useState(false)
  const [uncompletedTasks, setUncompletedTasks] = useState<UncompletedTask[]>([])
  const [userName, setUserName] = useState<string>('Вы')

  // Модальное окно создания привычки
  const [showHabitModal, setShowHabitModal] = useState(false)
  const [habitTaskText, setHabitTaskText] = useState('')
  const [habitFrequency, setHabitFrequency] = useState<FrequencyType>('daily')
  const [habitDays, setHabitDays] = useState<number[]>([])
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set())
  
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
    evaluate,
    // Habits
    habits,
    habitSuggestions,
    addHabitsToTasks,
    createHabitFromTask,
    deleteHabit,
  } = useDaily()

  // Проверить, является ли задача привычкой
  const getHabitForTask = (taskText: string) => {
    return habits.find(h => h.taskText.toLowerCase() === taskText.toLowerCase())
  }

  // Открыть модальное окно для создания привычки
  const openHabitModal = (taskText: string) => {
    setHabitTaskText(taskText)
    setHabitFrequency('daily')
    setHabitDays([])
    setShowHabitModal(true)
  }

  // Создать привычку с выбранными параметрами
  const handleCreateHabit = async () => {
    await createHabitFromTask(
      habitTaskText, 
      habitFrequency, 
      habitFrequency === 'weekly' || habitFrequency === 'custom' ? habitDays : undefined
    )
    setShowHabitModal(false)
  }

  // Переключить день недели
  const toggleDay = (day: number) => {
    setHabitDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

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
      const res = await fetch('/api/tasks/process-uncompleted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisions,
          sourceDate: selectedDate
        })
      })
      
      if (!res.ok) {
        console.error('Error processing uncompleted tasks')
      }
    } catch (error) {
      console.error('Error:', error)
    }
    
    // Продолжаем оценку
    evaluate(router)
  }

  // Загрузка имени пользователя
  useEffect(() => {
    const loadUserName = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          if (data?.user?.name) {
            setUserName(data.user.name)
          } else if (data?.user?.email) {
            // Если нет имени, берём первую часть email
            setUserName(data.user.email.split('@')[0])
          }
        }
      } catch {
        // ignore
      }
    }
    loadUserName()
  }, [])

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Ежедневное планирование</h1>
        <DatePickerWithIndicators value={selectedDate} onChange={setSelectedDate} />
      </div>

      <p className="text-lg text-gray-600 dark:text-gray-400">
        {mounted ? format(new Date(selectedDate), 'd MMMM yyyy, EEEE', { locale: ru }) : '\u00A0'}
      </p>

      {/* Context from periods */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700">
          <h3 className="font-medium text-sm text-blue-900 dark:text-blue-100 mb-2">Цели текущей недели:</h3>
          {weekGoals.length > 0 ? (
            <ul className="text-xs text-blue-800 space-y-0.5">
              {weekGoals.map((goal, index) => (
                <li key={index} className="flex items-center gap-1.5 leading-tight">
                  <span>•</span>
                  <span className="flex-1">{goal}</span>
                  <button
                    onClick={() => addGoalToTasks(goal)}
                    className="text-blue-600 hover:text-blue-800 text-xs px-1.5 py-0.5 bg-blue-100 hover:bg-blue-200 rounded whitespace-nowrap"
                    title="Добавить в план"
                  >
                    → в план
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-blue-600">Не установлены</p>
          )}
        </div>

        <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700">
          <h3 className="font-medium text-sm text-purple-900 dark:text-purple-100 mb-2">Цели текущего месяца:</h3>
          {monthGoals.length > 0 ? (
            <ul className="text-xs text-purple-800 space-y-0.5">
              {monthGoals.map((goal, index) => (
                <li key={index} className="flex items-center gap-1.5 leading-tight">
                  <span>•</span>
                  <span className="flex-1">{goal}</span>
                  <button
                    onClick={() => addGoalToTasks(goal)}
                    className="text-purple-600 hover:text-purple-800 text-xs px-1.5 py-0.5 bg-purple-100 hover:bg-purple-200 rounded whitespace-nowrap"
                    title="Добавить в план"
                  >
                    → в план
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-purple-600">Не установлены</p>
          )}
        </div>
      </div>

      {/* Plan and Chat side by side - 60/40 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Plan - Left (60%) */}
        <div className="lg:col-span-3 card flex flex-col !pr-0" style={{ minHeight: '500px', maxHeight: '80vh' }}>
          <div className="flex items-center justify-between mb-4 flex-shrink-0 pr-6">
            <h2 className="text-xl font-bold">📝 План на день</h2>
            {totalCount > 0 && (
              <span className={`text-sm px-3 py-1 rounded-full ${
                completionPercent === 100 ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                completionPercent >= 50 ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' :
                'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                ✅ {completedCount}/{totalCount} ({completionPercent}%)
                {extraDoneCount > 0 && ` +${extraDoneCount}`}
              </span>
            )}
          </div>

          {/* Добавление новой задачи */}
          <div className="mb-4 flex gap-2 flex-shrink-0 pr-6">
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
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400"
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
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg mr-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-amber-900 dark:text-amber-100 text-sm">🔄 Привычки на сегодня</h3>
                  {habitsNotInPlan.length > 0 && (
                    <button
                      onClick={() => addHabitsToTasks()}
                      className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-2 py-1 rounded transition-colors"
                    >
                      + Все в план
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {habits.map((habit) => {
                    const isInPlan = taskTextsLower.has(habit.taskText.toLowerCase())
                    return (
                      <span
                        key={habit.id}
                        className={`inline-flex items-center gap-1 text-xs pl-2 pr-1 py-1 rounded-full ${
                          isInPlan
                            ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 line-through opacity-60'
                            : 'bg-amber-100 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200'
                        }`}
                      >
                        <button
                          onClick={() => !isInPlan && addHabitsToTasks([habit.taskText])}
                          className={isInPlan ? 'cursor-default' : 'hover:text-amber-900 transition-colors'}
                          title={isInPlan ? 'Уже в плане' : 'Добавить в план'}
                          disabled={isInPlan}
                        >
                          {isInPlan && '✓ '}
                          {habit.taskText}
                          {habit.streak > 0 && <span className={`ml-1 ${isInPlan ? 'text-green-500' : 'text-amber-600'}`}>🔥{habit.streak}</span>}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(`Удалить привычку "${habit.taskText}"?`)) {
                              deleteHabit(habit.id)
                            }
                          }}
                          className="ml-1 text-amber-400 hover:text-red-500 transition-colors"
                          title="Удалить привычку"
                        >
                          ✕
                        </button>
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Предложения создать привычки */}
          {habitSuggestions.filter(s => !dismissedSuggestions.has(s.text)).length > 0 && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg mr-6">
              <h3 className="font-medium text-amber-900 dark:text-amber-100 text-sm mb-2">💡 Сделать привычкой?</h3>
              <div className="space-y-2">
                {habitSuggestions.filter(s => !dismissedSuggestions.has(s.text)).slice(0, 3).map((suggestion, index) => (
                  <div key={index} className="flex items-center justify-between text-sm gap-2">
                    <span className="text-amber-800 dark:text-amber-200 truncate flex-1">
                      "{suggestion.text}" — {suggestion.totalCount} раз
                    </span>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => createHabitFromTask(suggestion.text)}
                        className="w-7 h-7 flex items-center justify-center bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white rounded transition-colors"
                        title="Создать привычку"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setDismissedSuggestions(prev => new Set([...prev, suggestion.text]))}
                        className="w-7 h-7 flex items-center justify-center bg-gray-400 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-500 text-white rounded transition-colors"
                        title="Скрыть"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Список задач */}
          <div className="space-y-2 flex-1 overflow-y-auto pr-6 chat-scrollbar">
            {tasks.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">
                Добавьте задачи на день...
              </p>
            ) : (
              tasks.map((task, index) => (
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
                      ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                      : savedFlags[index]
                        ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 opacity-60'
                  } ${draggedTaskId === task.id ? 'opacity-50' : ''}`}
                >
                  <span className="text-gray-400 dark:text-gray-500 cursor-grab active:cursor-grabbing">⋮⋮</span>
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
                      className="flex-1 px-2 py-1 text-sm border border-primary-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white dark:border-primary-600"
                    />
                  ) : (
                    <span
                      className={`flex-1 text-sm text-gray-900 dark:text-gray-100 ${selectedTasks.has(task.id) ? 'line-through text-gray-500 dark:text-gray-400' : ''}`}
                      onDoubleClick={() => startEditingTask(task.id, task.taskText)}
                      title="Дважды кликните для редактирования"
                    >
                      {task.taskText}
                      {getHabitForTask(task.taskText) && (
                        <span className="ml-1 text-amber-500 text-xs" title="Это привычка">🔄</span>
                      )}
                    </span>
                  )}

                  {/* Кнопка создать/удалить привычку */}
                  {(() => {
                    const habit = getHabitForTask(task.taskText)
                    if (habit) {
                      // Задача является привычкой — показываем кнопку удаления цикла
                      return (
                        <button
                          onClick={() => {
                            if (confirm(`Снять цикличность с "${task.taskText}"?`)) {
                              deleteHabit(habit.id)
                            }
                          }}
                          className="text-amber-500 hover:text-red-500 text-sm px-1 py-1 opacity-70 hover:opacity-100 transition-all"
                          title="Снять цикличность (удалить привычку)"
                        >
                          ⏹️
                        </button>
                      )
                    } else {
                      // Не привычка — показываем кнопку создания
                      return (
                        <button
                          onClick={() => openHabitModal(task.taskText)}
                          className="text-amber-500 hover:text-amber-700 text-sm px-1 py-1 opacity-50 hover:opacity-100 transition-opacity"
                          title="Сделать привычкой"
                        >
                          🔄
                        </button>
                      )
                    }
                  })()}
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

          {/* Вне плана (перевыполнение) */}
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mr-6">
            <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">➕ Вне плана (перевыполнение)</h3>
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
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400"
              />
              <button onClick={addExtraTask} className="btn-primary text-sm py-2">
                Добавить
              </button>
            </div>

            {extraTasks.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Нет</p>
            ) : (
              <div className="space-y-1">
                {extraTasks.map((text, index) => (
                  <div key={`${index}-${text}`} className="flex items-center justify-between gap-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-gray-100">
                    <span className="flex-1">{text}</span>
                    <button
                      onClick={() => removeExtraTask(index)}
                      className="text-red-500 hover:text-red-700 text-sm px-2 py-1"
                      title="Удалить"
                    >
                      ✕
                    </button>
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
              className={`btn-primary disabled:opacity-50 w-full ${hasUnsavedChanges ? 'ring-2 ring-orange-400 ring-offset-2' : ''}`}
            >
              {saving ? 'Сохранение...' : hasUnsavedChanges ? '⚠️ Сохранить план' : '💾 Сохранить план'}
            </button>
          </div>
        </div>

        {/* Chat - Right (40%) */}
        <div className="lg:col-span-2 card flex flex-col !pr-0" style={{ minHeight: '500px', maxHeight: '80vh' }}>
          <div className="flex items-center justify-between mb-4 flex-shrink-0 pr-6">
            <h2 className="text-xl font-bold">💬 Обсуждение плана с ION</h2>
            {chatMessages.length > 0 && (
              <button 
                onClick={clearChat}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="Очистить чат"
              >
                🗑️ Очистить
              </button>
            )}
          </div>

          {/* Сообщения чата - занимает всё свободное пространство */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto space-y-3 py-2 pl-2 pr-6 bg-gray-50 dark:bg-gray-800 rounded-l-lg chat-scrollbar"
          >
            {chatMessages.length === 0 ? (
              <div className="py-4 space-y-3">
                <p className="text-center text-gray-400 dark:text-gray-500 text-sm mb-4">Спросите ION:</p>
                <button
                  onClick={() => sendChatMessage('Проанализируй мой план на день и дай рекомендации')}
                  disabled={sendingChat || tasks.length === 0}
                  className="w-full p-3 text-left bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  <span className="text-lg mr-2">🔍</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Проанализировать план</span>
                </button>
                <button
                  onClick={() => sendChatMessage('Оцени временные затраты на каждую задачу и скажи, реалистичен ли план по времени')}
                  disabled={sendingChat || tasks.length === 0}
                  className="w-full p-3 text-left bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  <span className="text-lg mr-2">⏰</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Оценить время</span>
                </button>
                <button
                  onClick={() => sendChatMessage('Как мой план связан с целями недели и месяца? Какие задачи стоит добавить?')}
                  disabled={sendingChat || tasks.length === 0}
                  className="w-full p-3 text-left bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  <span className="text-lg mr-2">🎯</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Связь с целями</span>
                </button>
                {tasks.length === 0 && (
                  <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Добавьте задачи в план
                  </p>
                )}
              </div>
            ) : (
              chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-primary-100 dark:bg-primary-900/30'
                      : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {msg.role === 'user' ? `👤 ${userName}` : '🤖 ION'}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))
            )}
            {sendingChat && (
              <div className="p-3 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">🤖 ION</span>
                  <span className="text-sm text-gray-400">печатает...</span>
                </div>
              </div>
            )}
          </div>

          {/* Ввод сообщения - прижато к низу */}
          <div className="flex gap-2 items-center mt-3 flex-shrink-0 pr-6">
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
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none overflow-hidden"
              style={{ minHeight: '42px' }}
            />
            <button
              onClick={() => sendChatMessage()}
              disabled={sendingChat || !chatInput.trim()}
              className="self-end mb-0.5 w-10 h-10 flex items-center justify-center bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors flex-shrink-0"
            >
              ➤
            </button>
          </div>
        </div>
      </div>

      {/* Evaluate */}
      <div className="card bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/30 dark:to-purple-900/30 border border-primary-200 dark:border-primary-700">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Получить оценку дня от ION</h2>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          После выполнения задач (отметьте чекбоксами), получите детальную оценку и обратную связь.
        </p>
        <button
          onClick={handleEvaluateClick}
          disabled={evaluating || selectedTasks.size === 0}
          className="btn-primary disabled:opacity-50"
        >
          {evaluating ? 'Получение оценки...' : 'Получить оценку дня'}
        </button>
        {dailyEntry?.evaluation && (
          <p className="mt-4 text-sm text-green-700 dark:text-green-400">
            ✅ Оценка за этот день уже получена. Вы можете получить новую оценку.
          </p>
        )}
      </div>

      {message && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 border border-gray-200 dark:border-gray-700 z-50">
          <p className="font-medium text-gray-900 dark:text-white">{message}</p>
        </div>
      )}

      {/* Модальное окно создания привычки */}
      {showHabitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">🔄 Создать привычку</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Задача:</label>
              <p className="text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 p-2 rounded">{habitTaskText}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Повторять:</label>
              <div className="space-y-2">
                {[
                  { value: 'daily', label: '📅 Ежедневно' },
                  { value: 'weekdays', label: '💼 По будням (Пн-Пт)' },
                  { value: 'weekends', label: '🌴 По выходным (Сб-Вс)' },
                  { value: 'weekly', label: '📆 Раз в неделю' },
                  { value: 'custom', label: '⚙️ Выбрать дни' },
                ].map(option => (
                  <label 
                    key={option.value} 
                    className={`flex items-center p-2 rounded-lg border cursor-pointer transition-colors ${
                      habitFrequency === option.value 
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="frequency"
                      value={option.value}
                      checked={habitFrequency === option.value}
                      onChange={(e) => setHabitFrequency(e.target.value as FrequencyType)}
                      className="mr-2"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Выбор дней для weekly и custom */}
            {(habitFrequency === 'weekly' || habitFrequency === 'custom') && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Дни недели:</label>
                <div className="flex gap-1">
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
                      onClick={() => toggleDay(day)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        habitDays.includes(day)
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowHabitModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateHabit}
                disabled={(habitFrequency === 'weekly' || habitFrequency === 'custom') && habitDays.length === 0}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

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
