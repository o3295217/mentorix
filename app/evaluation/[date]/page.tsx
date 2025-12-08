'use client'

import { useState, useEffect, use } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import Link from 'next/link'
import { DailyEntry, SuggestedTask } from '@/lib/types'

function getScoreColor(score: number): string {
  if (score >= 7) return 'text-green-600'
  if (score >= 5) return 'text-yellow-600'
  return 'text-red-600'
}

export default function EvaluationPage({ params }: { params: Promise<{ date: string }> }) {
  const resolvedParams = use(params)
  const [dailyEntry, setDailyEntry] = useState<DailyEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingTask, setAddingTask] = useState<string | null>(null)
  const [addedTasks, setAddedTasks] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadData()
  }, [resolvedParams.date])

  const loadData = async () => {
    try {
      const res = await fetch(`/api/daily?date=${resolvedParams.date}`)
      if (!res.ok) {
        console.error('Failed to load evaluation:', res.status)
        return
      }
      const data = await res.json()
      setDailyEntry(data)
    } catch (error) {
      console.error('Error loading evaluation:', error)
    } finally {
      setLoading(false)
    }
  }

  const addTaskToOpen = async (task: SuggestedTask) => {
    if (!dailyEntry) {
      alert('Ошибка: данные дня не загружены')
      return
    }
    setAddingTask(task.taskText)
    try {
      await fetch('/api/tasks/add-suggested', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskText: task.taskText,
          taskType: task.taskType,
          originDate: dailyEntry.date,
        }),
      })
      setAddedTasks(new Set(addedTasks).add(task.taskText))
    } catch (error) {
      console.error('Error adding task:', error)
      alert('Ошибка при добавлении задачи')
    } finally {
      setAddingTask(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-600">Загрузка...</div>
      </div>
    )
  }

  if (!dailyEntry || !dailyEntry.evaluation) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Оценка не найдена</h2>
        <p className="text-gray-600 mb-6">Для этого дня еще нет оценки</p>
        <Link href="/daily" className="btn-primary">
          Создать оценку
        </Link>
      </div>
    )
  }

  const evaluation = dailyEntry.evaluation
  const date = new Date(dailyEntry.date)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Оценка дня</h1>
        <Link href="/daily" className="btn-secondary">
          ← Назад
        </Link>
      </div>

      <p className="text-lg text-gray-600">{format(date, 'd MMMM yyyy, EEEE', { locale: ru })}</p>

      {/* ГЛАВНАЯ МЕТРИКА - Dream Progress Score */}
      <div className="card text-center bg-gradient-to-r from-purple-100 to-blue-100 border-2 border-purple-300">
        <h2 className="text-2xl font-bold mb-2 text-purple-900">🌟 Движение к мечте</h2>
        <p className={`text-7xl font-bold ${getScoreColor(evaluation.dreamProgressScore || evaluation.overallScore)}`}>
          {evaluation.dreamProgressScore || evaluation.overallScore}
        </p>
        <p className="text-gray-600 mt-2 text-lg">из 10</p>
        <p className="text-sm text-gray-600 mt-3 max-w-md mx-auto">
          Главная метрика: насколько этот день приблизил тебя к мечте
        </p>
      </div>

      {/* Overall Score - вторичная метрика */}
      <div className="card text-center bg-gradient-to-r from-primary-50 to-purple-50">
        <h2 className="text-xl font-semibold mb-2">Общая оценка (среднее по 4 показателям)</h2>
        <p className={`text-5xl font-bold ${getScoreColor(evaluation.overallScore)}`}>{evaluation.overallScore}</p>
        <p className="text-gray-600 mt-1">из 10</p>
      </div>

      {/* Scores breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-sm text-gray-600 mb-1">Стратегия</p>
          <p className={`text-3xl font-bold ${getScoreColor(evaluation.strategyScore)}`}>{evaluation.strategyScore}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-600 mb-1">Операции</p>
          <p className={`text-3xl font-bold ${getScoreColor(evaluation.operationsScore)}`}>{evaluation.operationsScore}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-600 mb-1">Команда</p>
          <p className={`text-3xl font-bold ${getScoreColor(evaluation.teamScore)}`}>{evaluation.teamScore}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-600 mb-1">Эффективность</p>
          <p className={`text-3xl font-bold ${getScoreColor(evaluation.efficiencyScore)}`}>{evaluation.efficiencyScore}</p>
        </div>
      </div>

      {/* Plan vs Fact */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">📊 План vs Факт</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">План:</h3>
            <p className="text-gray-800 whitespace-pre-wrap bg-gray-50 p-4 rounded">{dailyEntry.planText}</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Факт:</h3>
            <p className="text-gray-800 whitespace-pre-wrap bg-gray-50 p-4 rounded">{dailyEntry.factText}</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Анализ:</h3>
            <p className="text-gray-800 whitespace-pre-wrap">{evaluation.planVsFactText}</p>
          </div>
        </div>
      </div>

      {/* Feedback */}
      <div className="card bg-red-50 border border-red-200">
        <h2 className="text-xl font-bold mb-4 text-red-900">💬 Обратная связь</h2>
        <p className="text-gray-800 whitespace-pre-wrap">{evaluation.feedbackText}</p>
      </div>

      {/* Suggested Tasks */}
      {evaluation.suggestedTasksJson && JSON.parse(evaluation.suggestedTasksJson).length > 0 && (
        <div className="card bg-purple-50 border-2 border-purple-200">
          <h2 className="text-xl font-bold mb-4 text-purple-900">📋 Предложенные задачи</h2>
          <p className="text-sm text-gray-700 mb-4">
            ИИ выявил важные задачи, которые стоит добавить в список незакрытых
          </p>
          <div className="space-y-3">
            {(JSON.parse(evaluation.suggestedTasksJson) as SuggestedTask[]).map((task) => {
              const isAdded = addedTasks.has(task.taskText)
              const isAdding = addingTask === task.taskText

              return (
                <div key={task.taskText} className="p-4 bg-white rounded-lg border-2 border-purple-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          task.taskType === 'strategic'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {task.taskType === 'strategic' ? '🎯 Стратегическая' : '⚙️ Операционная'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          task.priority === 'high'
                            ? 'bg-red-100 text-red-700'
                            : task.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {task.priority === 'high' ? '🔥 Высокий' : task.priority === 'medium' ? '⚡ Средний' : '📌 Низкий'}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">{task.taskText}</h3>
                      <p className="text-sm text-gray-600">{task.reason}</p>
                    </div>
                    <button
                      onClick={() => addTaskToOpen(task)}
                      disabled={isAdded || isAdding}
                      className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
                        isAdded
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                    >
                      {isAdding ? 'Добавление...' : isAdded ? '✓ Добавлено' : '+ Добавить'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 p-3 bg-purple-100 rounded">
            <p className="text-sm text-purple-900">
              💡 Добавленные задачи появятся на вкладке <Link href="/tasks" className="font-semibold underline">Незакрытые задачи</Link>
            </p>
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="card bg-green-50 border border-green-200">
        <h2 className="text-xl font-bold mb-4 text-green-900">💡 Рекомендации</h2>
        <p className="text-gray-800 whitespace-pre-wrap">{evaluation.recommendationsText}</p>
      </div>
    </div>
  )
}
