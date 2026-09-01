'use client'

import { useState, useEffect, use, useMemo } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import Link from 'next/link'
import { DailyEntry, OpenTask, SuggestedTask } from '@/lib/types'
import { areTasksSimilar } from '@/lib/task-match'
import { safeParseJson } from '@/lib/safe-json'

function getScoreColor(score: number): string {
  if (score >= 7) return 'text-green-400'
  if (score >= 5) return 'text-yellow-400'
  return 'text-red-400'
}

// Структура для задач с статусом
interface TaskWithStatus {
  text: string
  status: 'completed' | 'not_completed' | 'extra'
}

// Вычисление списка задач со статусами
function computeTasksWithStatus(
  planText: string | null,
  selectedTasksJson: unknown,
  extraTasksJson: unknown
): TaskWithStatus[] {
  const planTasks = (planText || '').split('\n').map(t => t.trim()).filter(Boolean)
  
  const selectedIds = safeParseJson<Array<string | number>>(selectedTasksJson, [])
    .map(id => Number(id))
    .filter(id => Number.isInteger(id) && id > 0 && id <= planTasks.length)
  
  const selectedSet = new Set(selectedIds)
  const result: TaskWithStatus[] = []
  
  // Добавляем задачи из плана со статусом
  planTasks.forEach((task, index) => {
    const id = index + 1
    result.push({
      text: task,
      status: selectedSet.has(id) ? 'completed' : 'not_completed'
    })
  })
  
  // Добавить extraTasks
  const extras = safeParseJson<string[]>(extraTasksJson, [])
  extras.forEach((t: string) => {
    if (t) {
      result.push({ text: t, status: 'extra' })
    }
  })
  
  return result
}

export default function EvaluationPage({ params }: { params: Promise<{ date: string }> }) {
  const resolvedParams = use(params)
  const [dailyEntry, setDailyEntry] = useState<DailyEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingTask, setAddingTask] = useState<string | null>(null)
  const [addedTasks, setAddedTasks] = useState<Set<string>>(new Set())
  const [openTasks, setOpenTasks] = useState<OpenTask[]>([])
  const [taskError, setTaskError] = useState('')
  // Список задач в «Результате дня» по умолчанию свёрнут — сводка в бейджах
  const [tasksExpanded, setTasksExpanded] = useState(false)

  useEffect(() => {
    loadData()
  }, [resolvedParams.date])

  const loadData = async () => {
    try {
      const [dailyRes, tasksRes] = await Promise.all([
        fetch(`/api/daily?date=${resolvedParams.date}`),
        fetch('/api/tasks/open'),
      ])

      if (!dailyRes.ok) {
        console.error('Failed to load evaluation:', dailyRes.status)
        return
      }

      const data = await dailyRes.json()
      setDailyEntry(data)

      if (tasksRes.ok) {
        const tasks = await tasksRes.json()
        setOpenTasks(Array.isArray(tasks) ? tasks : [])
      }
    } catch (error) {
      console.error('Error loading evaluation:', error)
    } finally {
      setLoading(false)
    }
  }

  const addTaskToOpen = async (task: SuggestedTask) => {
    if (!dailyEntry) {
      setTaskError('Данные дня не загружены')
      return
    }
    setTaskError('')
    setAddingTask(task.taskText)
    try {
      const res = await fetch('/api/tasks/add-suggested', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskText: task.taskText,
          taskType: task.taskType,
          // Важно: отправляем date-only ключ из URL, чтобы не было timezone-сдвигов
          originDate: resolvedParams.date,
        }),
      })

      // 409 = задача уже существует (по смыслу считаем "перенесено")
      if (!res.ok && res.status !== 409) {
        throw new Error(`Failed to add task: ${res.status}`)
      }

      setAddedTasks((current) => new Set(current).add(task.taskText))
      // Перечитать dailyEntry, чтобы предложенная задача исчезла и после обновления страницы
      await loadData()
    } catch (error) {
      console.error('Error adding task:', error)
      setTaskError('Ошибка при добавлении задачи')
    } finally {
      setAddingTask(null)
    }
  }

  // Вычисляем список задач со статусами (хук должен быть до условных return)
  const tasksWithStatus = useMemo(() => {
    if (!dailyEntry) return []
    return computeTasksWithStatus(
      dailyEntry.planText ?? null,
      dailyEntry.selectedTasksJson ?? null,
      dailyEntry.extraTasksJson ?? null
    )
  }, [dailyEntry])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-400">Загрузка...</div>
      </div>
    )
  }

  if (!dailyEntry || !dailyEntry.evaluation) {
    return (
      <div className="text-center py-12">
        <h2 className="font-bold mb-4 text-white">Оценка не найдена</h2>
        <p className="text-gray-400 mb-6">Для этого дня еще нет оценки</p>
        <Link href="/daily" className="btn-primary">
          Создать оценку
        </Link>
      </div>
    )
  }

  const evaluation = dailyEntry.evaluation
  const date = new Date(dailyEntry.date)

  const suggestedTasks = safeParseJson<SuggestedTask[]>(evaluation.suggestedTasksJson, [])

  const duplicateSuggestedTasks = suggestedTasks.filter((s) =>
    openTasks.some((t) => areTasksSimilar(t.taskText, s.taskText))
  )

  const visibleSuggestedTasks = suggestedTasks.filter((s) =>
    !openTasks.some((t) => areTasksSimilar(t.taskText, s.taskText))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Оценка дня</h1>
        <Link href="/daily" className="btn-secondary">
          ← Назад
        </Link>
      </div>

      <p className="text-lg text-gray-400">{format(date, 'd MMMM yyyy, EEEE', { locale: ru })}</p>

      {/* Две главные оценки в одну строку */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <h2 className="font-bold mb-2 text-purple-100">Движение к мечте</h2>
          <p className={`text-5xl font-bold ${getScoreColor(evaluation.dreamProgressScore || evaluation.overallScore)}`}>
            {evaluation.dreamProgressScore || evaluation.overallScore}
          </p>
          <p className="text-gray-400 mt-1">из 10</p>
        </div>
        <div className="card text-center">
          <h2 className="font-bold mb-2 text-white">Общая оценка</h2>
          <p className={`text-5xl font-bold ${getScoreColor(evaluation.overallScore)}`}>{evaluation.overallScore}</p>
          <p className="text-gray-400 mt-1">из 10</p>
        </div>
      </div>

      {/* Scores breakdown — 5 категорий */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card text-center">
          <p className="text-sm text-gray-400 mb-1">Движение к мечте</p>
          <p className={`text-3xl font-bold ${getScoreColor(evaluation.dreamProgressScore)}`}>{evaluation.dreamProgressScore}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-400 mb-1">Стратег. фокус</p>
          <p className={`text-3xl font-bold ${getScoreColor(evaluation.strategicFocusScore)}`}>{evaluation.strategicFocusScore}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-400 mb-1">Продуктивность</p>
          <p className={`text-3xl font-bold ${getScoreColor(evaluation.productivityScore)}`}>{evaluation.productivityScore}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-400 mb-1">Баланс жизни</p>
          <p className={`text-3xl font-bold ${getScoreColor(evaluation.lifeBalanceScore)}`}>{evaluation.lifeBalanceScore}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-400 mb-1">Дисциплина</p>
          <p className={`text-3xl font-bold ${getScoreColor(evaluation.disciplineScore)}`}>{evaluation.disciplineScore}</p>
        </div>
      </div>

      {/* Plan vs Fact - Единый список */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Результат дня</h2>
        
        {/* Статистика */}
        {(() => {
          const completed = tasksWithStatus.filter(t => t.status === 'completed').length
          const notCompleted = tasksWithStatus.filter(t => t.status === 'not_completed').length
          const extra = tasksWithStatus.filter(t => t.status === 'extra').length
          const total = completed + notCompleted
          const percent = total > 0 ? Math.round((completed / total) * 100) : 0
          
          return (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-sm">
              <span className="px-3 py-1 rounded-full bg-green-900/40 text-green-200">
                 Выполнено: {completed}/{total} ({percent}%)
              </span>
              {notCompleted > 0 && (
                <span className="px-3 py-1 rounded-full bg-red-900/40 text-red-200">
                   Не выполнено: {notCompleted}
                </span>
              )}
              {extra > 0 && (
                <span className="px-3 py-1 rounded-full bg-blue-900/40 text-blue-200">
                   Сверх плана: {extra}
                </span>
              )}
              {tasksWithStatus.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTasksExpanded((open) => !open)}
                  aria-expanded={tasksExpanded}
                  aria-controls="day-result-task-list"
                  className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full border border-gray-700 px-3 py-1 text-gray-300 transition hover:bg-gray-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  {tasksExpanded ? 'Свернуть список' : `Показать список (${tasksWithStatus.length})`}
                  <span aria-hidden="true" className="text-xs">{tasksExpanded ? '▴' : '▾'}</span>
                </button>
              )}
            </div>
          )
        })()}

        {/* Список задач — по умолчанию свёрнут, сводка выше в бейджах */}
        {tasksExpanded && (
        <div id="day-result-task-list" className="space-y-1.5 mb-6">
          {tasksWithStatus.map((task, index) => (
            <div
              key={index}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                task.status === 'completed'
                  ? 'bg-green-900/20 border-green-800'
                  : task.status === 'not_completed'
                  ? 'bg-red-900/20 border-red-800'
                  : 'bg-blue-900/20 border-blue-800'
              }`}
            >
              <span className="text-sm flex-shrink-0">
                {task.status === 'completed' ? '✓' : task.status === 'not_completed' ? '✕' : '+'}
              </span>
              <span className={`flex-1 ${ task.status === 'completed' ? 'text-green-300' : task.status === 'not_completed' ? 'text-red-300' : 'text-blue-100'}`}>
                {task.text}
                {task.status === 'extra' && (
                  <span className="ml-2 text-xs text-blue-400">(сверх плана)</span>
                )}
              </span>
            </div>
          ))}
          
          {tasksWithStatus.length === 0 && (
            <p className="text-gray-400 italic text-center py-4">Нет задач</p>
          )}
        </div>
        )}

        {/* Анализ */}
        <div className="border-t border-gray-700 pt-4">
          <h3 className="font-semibold text-gray-300 mb-2"> Анализ:</h3>
          <p className="text-gray-200 whitespace-pre-wrap">{evaluation.planVsFactText}</p>
        </div>
      </div>

      {/* Feedback — 3 целевых блока */}
      <div className="card">
        <div className="mb-4">
          <p className="eyebrow mb-1">ИИ-оценка</p>
          <h2 className="text-xl font-semibold text-red-100">Обратная связь</h2>
        </div>
        {(() => {
          // Пробуем распарсить структурированный feedback (новый формат)
          let feedbackBlocks: { conclusion?: string; worked?: string; blocks?: string } | null = null
          try {
            const parsed = JSON.parse(evaluation.feedbackText)
            if (parsed && typeof parsed === 'object' && parsed.conclusion) {
              feedbackBlocks = parsed
            }
          } catch {
            // Старый формат — plain text
          }

          if (feedbackBlocks) {
            return (
              <div className="space-y-3">
                <section className="feedback-block feedback-block-primary" aria-labelledby="feedback-conclusion-title">
                  <p className="eyebrow mb-1 text-purple-300/80">Фокус</p>
                  <h3 id="feedback-conclusion-title" className="font-semibold text-purple-200 mb-2">Главный вывод</h3>
                  <p className="text-gray-200 whitespace-pre-wrap">{feedbackBlocks.conclusion}</p>
                </section>
                {feedbackBlocks.worked && (
                  <section className="feedback-block feedback-block-success" aria-labelledby="feedback-worked-title">
                    <p className="eyebrow mb-1 text-green-300/80">Опора</p>
                    <h3 id="feedback-worked-title" className="font-semibold text-green-200 mb-2">Что сработало</h3>
                    <p className="text-gray-200 whitespace-pre-wrap">{feedbackBlocks.worked}</p>
                  </section>
                )}
                {feedbackBlocks.blocks && (
                  <section className="feedback-block feedback-block-warning" aria-labelledby="feedback-blocks-title">
                    <p className="eyebrow mb-1 text-orange-300/80">Риск</p>
                    <h3 id="feedback-blocks-title" className="font-semibold text-orange-200 mb-2">Что тормозит</h3>
                    <p className="text-gray-200 whitespace-pre-wrap">{feedbackBlocks.blocks}</p>
                  </section>
                )}
              </div>
            )
          }

          // Fallback для старых записей — plain text
          return <p className="text-gray-200 whitespace-pre-wrap">{evaluation.feedbackText}</p>
        })()}
      </div>

      {/* Suggested Tasks */}
      {taskError && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          {taskError}
        </div>
      )}

      {(visibleSuggestedTasks.length > 0 || duplicateSuggestedTasks.length > 0) && (
        <div className="card">
          <h2 className="font-bold mb-4 text-purple-100"> Предложенные задачи</h2>
          <p className="text-sm text-gray-300 mb-4">ИИ выявил важные задачи, которые стоит добавить в список незакрытых</p>

          {duplicateSuggestedTasks.length > 0 && (
            <div className="mb-4 p-3 rounded bg-purple-800/50">
              <p className="text-purple-100">
                 По этой теме уже есть незакрытые задачи (совпадение по названию/смыслу). Вместо создания дубля — сфокусируйся на закрытии
                существующей во вкладке{' '}
                <Link href="/tasks" className="font-semibold underline">Задачи</Link>.
              </p>
            </div>
          )}
          <div className="space-y-3">
            {visibleSuggestedTasks.map((task) => {
              const isAdded = addedTasks.has(task.taskText)
              const isAdding = addingTask === task.taskText

              return (
                <div key={task.taskText} className="p-4 bg-gray-900/80 rounded-lg border-purple-600">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          task.taskType === 'strategic'
                            ? 'bg-purple-900/40 text-purple-300'
                            : 'bg-blue-900/40 text-blue-300'
                        }`}>
                          {task.taskType === 'strategic' ? ' Стратегическая' : ' Операционная'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          task.priority === 'high'
                            ? 'bg-red-900/40 text-red-300'
                            : task.priority === 'medium'
                            ? 'bg-yellow-900/40 text-yellow-300'
                            : 'bg-gray-800 text-gray-300'
                        }`}>
                          {task.priority === 'high' ? ' Высокий' : task.priority === 'medium' ? ' Средний' : ' Низкий'}
                        </span>
                      </div>
                      <h3 className="font-semibold text-white mb-2">{task.taskText}</h3>
                      <p className="text-sm text-gray-400">{task.reason}</p>
                    </div>
                    <button
                      onClick={() => addTaskToOpen(task)}
                      disabled={isAdded || isAdding}
                      className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
                        isAdded
                          ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                    >
                      {isAdding ? 'Добавление...' : isAdded ? ' Добавлено' : '+ Добавить'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          {visibleSuggestedTasks.length > 0 && (
            <div className="mt-4 p-3 rounded bg-purple-800/50">
              <p className="text-purple-100">
                 Добавленные задачи появятся на вкладке <Link href="/tasks" className="font-semibold underline">Задачи</Link>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      <div className="card">
        <h2 className="font-bold mb-4 text-green-100"> Рекомендации</h2>
        <p className="text-gray-200 whitespace-pre-wrap">{evaluation.recommendationsText}</p>
      </div>
    </div>
  )
}
