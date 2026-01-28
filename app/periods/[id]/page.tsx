'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface PeriodEvaluation {
  id: number
  periodType: string
  periodStart: string
  periodEnd: string
  dreamProgressScore: number
  overallScore: number
  professionalBlock: string
  personalBlock: string
  socialBlock: string
  balanceBlock: string
  patterns: string
  trends: string
  goalsCompletion: string
  alignment: string
  blockers: string | null
  feedbackText: string
  recommendationsText: string
  insights: string | null
  createdAt: string
}

export default function PeriodDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const [evaluation, setEvaluation] = useState<PeriodEvaluation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvaluation()
  }, [id])

  const fetchEvaluation = async () => {
    try {
      const res = await fetch(`/api/periods/${id}`)
      if (!res.ok) {
        console.error('Failed to load evaluation:', res.status)
        return
      }
      const data = await res.json()
      setEvaluation(data)
    } catch (error) {
      console.error('Error fetching evaluation:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-600 dark:text-gray-300">Загрузка...</div>
      </div>
    )
  }

  if (!evaluation) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-red-600">Оценка не найдена</p>
        <Link href="/periods" className="btn-primary mt-4 inline-block">
          ← К списку оценок
        </Link>
      </div>
    )
  }

  const professionalBlock = JSON.parse(evaluation.professionalBlock)
  const personalBlock = JSON.parse(evaluation.personalBlock)
  const socialBlock = JSON.parse(evaluation.socialBlock)
  const balanceBlock = JSON.parse(evaluation.balanceBlock)
  const patterns = JSON.parse(evaluation.patterns)
  const trends = JSON.parse(evaluation.trends)
  const goalsCompletion = JSON.parse(evaluation.goalsCompletion)
  const blockers = evaluation.blockers ? JSON.parse(evaluation.blockers) : null

  const getPeriodLabel = (type: string) => {
    const labels: Record<string, string> = {
      week: '📅 Неделя',
      month: '📆 Месяц',
      quarter: '📊 Квартал',
      year: '🗓️ Год',
      custom: '🔧 Произвольный',
    }
    return labels[type] || type
  }

  const getRiskColor = (risk: string) => {
    const colors: Record<string, string> = {
      'низкий': 'text-green-600',
      'средний': 'text-yellow-600',
      'высокий': 'text-orange-600',
      'критичный': 'text-red-600',
    }
    return colors[risk] || 'text-gray-600'
  }

  const getTrendIcon = (trend: string) => {
    const icons: Record<string, string> = {
      'растет': '📈',
      'стабильно': '➡️',
      'падает': '📉',
    }
    return icons[trend] || '➡️'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {getPeriodLabel(evaluation.periodType)}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {format(new Date(evaluation.periodStart), 'd MMMM', { locale: ru })} - {format(new Date(evaluation.periodEnd), 'd MMMM yyyy', { locale: ru })}
          </p>
        </div>
        <Link href="/periods" className="btn-secondary">
          ← Назад к списку
        </Link>
      </div>

      {/* Main Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 dark:from-purple-950/30 dark:to-purple-900/30 dark:border-purple-900">
          <h3 className="text-sm font-medium text-purple-600 mb-1">Прогресс к мечте</h3>
          <p className="text-4xl font-bold text-purple-700">{evaluation.dreamProgressScore.toFixed(1)}/10</p>
        </div>
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 dark:from-blue-950/30 dark:to-blue-900/30 dark:border-blue-900">
          <h3 className="text-sm font-medium text-blue-600 mb-1">Общая эффективность</h3>
          <p className="text-4xl font-bold text-blue-700">{evaluation.overallScore.toFixed(1)}/10</p>
        </div>
      </div>

      {/* Professional Block */}
      <div className="card bg-blue-50 border-2 border-blue-200 dark:bg-blue-950/25 dark:border-blue-900">
        <h2 className="text-xl font-bold mb-3">💼 Профессиональный блок</h2>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">Стратегия</p>
            <p className="text-2xl font-bold text-blue-600">{professionalBlock.strategyAvg.toFixed(1)}/10</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">Операции</p>
            <p className="text-2xl font-bold text-blue-600">{professionalBlock.operationsAvg.toFixed(1)}/10</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">Команда</p>
            <p className="text-2xl font-bold text-blue-600">{professionalBlock.teamAvg.toFixed(1)}/10</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
          <p className="whitespace-pre-wrap">{professionalBlock.analysis}</p>
        </div>
      </div>

      {/* Personal Block */}
      <div className="card bg-green-50 border-2 border-green-200 dark:bg-green-950/25 dark:border-green-900">
        <h2 className="text-xl font-bold mb-3">❤️ Личный блок</h2>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">Здоровье</p>
            <p className="text-2xl font-bold text-green-600">{personalBlock.healthScore}/10</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">Семья</p>
            <p className="text-2xl font-bold text-green-600">{personalBlock.familyScore}/10</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">Энергия</p>
            <p className="text-2xl font-bold text-green-600">{personalBlock.energyScore}/10</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
          <p className="whitespace-pre-wrap">{personalBlock.analysis}</p>
        </div>
      </div>

      {/* Social Block */}
      <div className="card bg-yellow-50 border-2 border-yellow-200 dark:bg-yellow-950/25 dark:border-yellow-900">
        <h2 className="text-xl font-bold mb-3">👥 Социальный блок</h2>
        <div className="mb-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">Командная работа</p>
          <p className="text-2xl font-bold text-yellow-600">{socialBlock.teamworkScore}/10</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
          <p className="whitespace-pre-wrap">{socialBlock.analysis}</p>
        </div>
      </div>

      {/* Balance Block */}
      <div className="card bg-red-50 border-2 border-red-200 dark:bg-red-950/25 dark:border-red-900">
        <h2 className="text-xl font-bold mb-3">⚖️ Баланс и риски</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">Work-Life Balance</p>
            <p className="text-2xl font-bold text-red-600">{balanceBlock.workLifeBalance}/10</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">Риск выгорания</p>
            <p className={`text-2xl font-bold ${getRiskColor(balanceBlock.riskOfBurnout)}`}>
              {balanceBlock.riskOfBurnout}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
          <p className="whitespace-pre-wrap">{balanceBlock.analysis}</p>
        </div>
      </div>

      {/* Trends */}
      <div className="card bg-purple-50 border-2 border-purple-200 dark:bg-purple-950/25 dark:border-purple-900">
        <h2 className="text-xl font-bold mb-3">📈 Тренды</h2>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Dream Progress</p>
            <p className="text-3xl mb-1">{getTrendIcon(trends.dreamProgressTrend)}</p>
            <p className="text-sm font-semibold">{trends.dreamProgressTrend}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Overall Score</p>
            <p className="text-3xl mb-1">{getTrendIcon(trends.overallTrend)}</p>
            <p className="text-sm font-semibold">{trends.overallTrend}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Strategy Score</p>
            <p className="text-3xl mb-1">{getTrendIcon(trends.strategyTrend)}</p>
            <p className="text-sm font-semibold">{trends.strategyTrend}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
          <p className="whitespace-pre-wrap">{trends.description}</p>
        </div>
      </div>

      {/* Patterns */}
      <div className="card bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-700">
        <h2 className="text-xl font-bold mb-3">🔄 Паттерны поведения</h2>
        <div className="space-y-3">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold mb-2 text-green-600">✅ Лучшие дни</h3>
            <p>{patterns.bestDays.join(', ')}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold mb-2 text-red-600">❌ Худшие дни</h3>
            <p>{patterns.worstDays.join(', ')}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold mb-2">📊 Паттерн продуктивности</h3>
            <p className="whitespace-pre-wrap">{patterns.productivityPattern}</p>
          </div>
          {patterns.balanceIssues.length > 0 && (
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold mb-2 text-orange-600">⚠️ Проблемы с балансом</h3>
              <ul className="list-disc list-inside">
                {patterns.balanceIssues.map((issue: string) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Goals Completion */}
      <div className="card bg-teal-50 dark:bg-teal-900/20 border-2 border-teal-200 dark:border-teal-700">
        <h2 className="text-xl font-bold mb-3">🎯 Выполнение целей</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">Всего</p>
            <p className="text-2xl font-bold">{goalsCompletion.totalGoals}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">Выполнено</p>
            <p className="text-2xl font-bold text-green-600">{goalsCompletion.completedGoals}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">В процессе</p>
            <p className="text-2xl font-bold text-yellow-600">{goalsCompletion.inProgressGoals}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">Не начато</p>
            <p className="text-2xl font-bold text-red-600">{goalsCompletion.notStartedGoals}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg mb-3 border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Процент выполнения</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4">
              <div
                className="bg-green-500 h-4 rounded-full transition-all"
                style={{ width: `${goalsCompletion.completionRate}%` }}
              />
            </div>
            <p className="text-2xl font-bold text-green-600">{goalsCompletion.completionRate}%</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
          <p className="whitespace-pre-wrap">{goalsCompletion.analysis}</p>
        </div>
      </div>

      {/* Alignment */}
      <div className="card bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-700">
        <h2 className="text-xl font-bold mb-3">🎯 Alignment (выравнивание целей)</h2>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
          <p className="whitespace-pre-wrap">{evaluation.alignment}</p>
        </div>
      </div>

      {/* Blockers */}
      {blockers && (blockers.strategic.length > 0 || blockers.operational.length > 0 || blockers.personal.length > 0) && (
        <div className="card bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700">
          <h2 className="text-xl font-bold mb-3">🚫 Блокеры</h2>
          <div className="space-y-3">
            {blockers.strategic.length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold mb-2 text-red-600">Стратегические</h3>
                <ul className="list-disc list-inside">
                  {blockers.strategic.map((blocker: string) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            )}
            {blockers.operational.length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold mb-2 text-orange-600">Операционные</h3>
                <ul className="list-disc list-inside">
                  {blockers.operational.map((blocker: string) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            )}
            {blockers.personal.length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold mb-2 text-yellow-600">Личные</h3>
                <ul className="list-disc list-inside">
                  {blockers.personal.map((blocker: string) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feedback */}
      <div className="card bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 border-2 border-pink-200 dark:border-pink-700">
        <h2 className="text-xl font-bold mb-3">💬 Обратная связь от ИИ-коуча</h2>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
          <p className="whitespace-pre-wrap text-lg leading-relaxed">{evaluation.feedbackText}</p>
        </div>
      </div>

      {/* Recommendations */}
      <div className="card bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 border-2 border-green-200 dark:border-green-700">
        <h2 className="text-xl font-bold mb-3">💡 Рекомендации на следующий период</h2>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
          <p className="whitespace-pre-wrap text-lg leading-relaxed">{evaluation.recommendationsText}</p>
        </div>
      </div>

      {/* Insights */}
      {evaluation.insights && (
        <div className="card bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 border-2 border-purple-300 dark:border-purple-700">
          <h2 className="text-xl font-bold mb-3">🔮 Глубокие инсайты</h2>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
            <p className="whitespace-pre-wrap text-lg leading-relaxed">{evaluation.insights}</p>
          </div>
        </div>
      )}
    </div>
  )
}
