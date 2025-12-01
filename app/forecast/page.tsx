'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'

interface ForecastResponse {
  forecast: {
    currentPeriodForecast?: {
      periodType: string
      completionProbability: number
      expectedCompletionRate: number
      daysRemaining: number
      currentPace: string
      recommendations: string[]
    }
    dreamForecast: {
      estimatedYears: number
      onTrack: boolean
      dreamProgressRate: number
      adjustmentNeeded: string
    }
    whatIfScenarios: Array<{
      scenario: string
      impact: string
      probability: string
    }>
    keyRecommendations: string[]
    summary: string
  }
  metadata: {
    historicalDaysCount: number
    periodStart: string
    periodEnd: string
    dreamGoal: string
    dreamYears: number
  }
}

export default function ForecastPage() {
  const [forecastType, setForecastType] = useState<'comprehensive' | 'current_period' | 'dream_achievement'>('comprehensive')
  const [periodType, setPeriodType] = useState<'week' | 'month' | 'quarter' | 'year' | null>(null)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [historicalDays, setHistoricalDays] = useState(30)
  const [loading, setLoading] = useState(false)
  const [forecast, setForecast] = useState<ForecastResponse | null>(null)

  const selectQuickPeriod = (type: 'week' | 'month' | 'quarter' | 'year') => {
    const today = new Date()
    let start: Date
    let end: Date

    switch (type) {
      case 'week':
        start = startOfWeek(today, { weekStartsOn: 1 })
        end = endOfWeek(today, { weekStartsOn: 1 })
        break
      case 'month':
        start = startOfMonth(today)
        end = endOfMonth(today)
        break
      case 'quarter':
        start = startOfQuarter(today)
        end = endOfQuarter(today)
        break
      case 'year':
        start = startOfYear(today)
        end = endOfYear(today)
        break
    }

    setPeriodType(type)
    setPeriodStart(format(start, 'yyyy-MM-dd'))
    setPeriodEnd(format(end, 'yyyy-MM-dd'))
  }

  const generateForecast = async () => {
    setLoading(true)
    try {
      const body: {
        forecastType: string
        historicalDays: number
        periodType?: string
        periodStart?: string
        periodEnd?: string
      } = {
        forecastType,
        historicalDays,
      }

      if (forecastType === 'current_period' && periodType && periodStart && periodEnd) {
        body.periodType = periodType
        body.periodStart = periodStart
        body.periodEnd = periodEnd
      } else if (forecastType === 'comprehensive' && periodType && periodStart && periodEnd) {
        body.periodType = periodType
        body.periodStart = periodStart
        body.periodEnd = periodEnd
      }

      const res = await fetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to generate forecast')
      }

      const data = await res.json()
      setForecast(data)
    } catch (error) {
      console.error('Error generating forecast:', error)
      alert(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setLoading(false)
    }
  }

  const getPaceColor = (pace: string) => {
    const colors: Record<string, string> = {
      'отстает': 'text-red-600',
      'в темпе': 'text-green-600',
      'опережает': 'text-blue-600',
    }
    return colors[pace] || 'text-gray-600'
  }

  const getProbabilityColor = (probability: string) => {
    const colors: Record<string, string> = {
      'низкая': 'text-gray-600',
      'средняя': 'text-yellow-600',
      'высокая': 'text-red-600',
    }
    return colors[probability] || 'text-gray-600'
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Прогнозы и предсказания</h1>
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          ← На главную
        </Link>
      </div>

      {/* Forecast Configuration */}
      <div className="card bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
        <h2 className="text-2xl font-bold mb-4">Настройки прогноза</h2>

        {/* Forecast Type Selection */}
        <div className="mb-6">
          <label className="block font-semibold mb-2">Тип прогноза</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => setForecastType('comprehensive')}
              className={`p-4 rounded-lg border-2 transition-all ${
                forecastType === 'comprehensive'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white border-gray-300 hover:border-purple-400'
              }`}
            >
              <div className="text-2xl mb-1">🔮</div>
              <div className="font-semibold">Комплексный</div>
              <div className="text-xs mt-1 opacity-75">Все типы анализа</div>
            </button>

            <button
              onClick={() => setForecastType('current_period')}
              className={`p-4 rounded-lg border-2 transition-all ${
                forecastType === 'current_period'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white border-gray-300 hover:border-purple-400'
              }`}
            >
              <div className="text-2xl mb-1">📅</div>
              <div className="font-semibold">Текущий период</div>
              <div className="text-xs mt-1 opacity-75">Выполнение целей</div>
            </button>

            <button
              onClick={() => setForecastType('dream_achievement')}
              className={`p-4 rounded-lg border-2 transition-all ${
                forecastType === 'dream_achievement'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white border-gray-300 hover:border-purple-400'
              }`}
            >
              <div className="text-2xl mb-1">🌟</div>
              <div className="font-semibold">Достижение мечты</div>
              <div className="text-xs mt-1 opacity-75">Долгосрочный план</div>
            </button>
          </div>
        </div>

        {/* Period Selection (for current_period and comprehensive) */}
        {(forecastType === 'current_period' || forecastType === 'comprehensive') && (
          <div className="mb-6">
            <label className="block font-semibold mb-2">Период для анализа</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <button
                onClick={() => selectQuickPeriod('week')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  periodType === 'week'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white border-gray-300 hover:border-blue-400'
                }`}
              >
                📅 Неделя
              </button>
              <button
                onClick={() => selectQuickPeriod('month')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  periodType === 'month'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white border-gray-300 hover:border-blue-400'
                }`}
              >
                📆 Месяц
              </button>
              <button
                onClick={() => selectQuickPeriod('quarter')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  periodType === 'quarter'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white border-gray-300 hover:border-blue-400'
                }`}
              >
                📊 Квартал
              </button>
              <button
                onClick={() => selectQuickPeriod('year')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  periodType === 'year'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white border-gray-300 hover:border-blue-400'
                }`}
              >
                🗓️ Год
              </button>
            </div>
          </div>
        )}

        {/* Historical Days */}
        <div className="mb-6">
          <label className="block font-semibold mb-2">
            Исторические данные (дней для анализа): {historicalDays}
          </label>
          <input
            type="range"
            min="7"
            max="90"
            value={historicalDays}
            onChange={(e) => setHistoricalDays(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>7 дней</span>
            <span>90 дней</span>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateForecast}
          disabled={loading}
          className="btn-primary w-full text-lg"
        >
          {loading ? 'Генерирую прогноз...' : '🔮 Сгенерировать прогноз'}
        </button>
      </div>

      {/* Forecast Results */}
      {forecast && (
        <div className="space-y-6">
          {/* Metadata */}
          <div className="card bg-gray-50 border-2 border-gray-200">
            <h3 className="font-semibold mb-2">ℹ️ Информация о прогнозе</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-gray-600">Исторических дней</p>
                <p className="font-bold">{forecast.metadata.historicalDaysCount}</p>
              </div>
              <div>
                <p className="text-gray-600">Период анализа</p>
                <p className="font-bold">
                  {format(new Date(forecast.metadata.periodStart), 'd MMM', { locale: ru })} - {format(new Date(forecast.metadata.periodEnd), 'd MMM', { locale: ru })}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Мечта</p>
                <p className="font-bold line-clamp-2">{forecast.metadata.dreamGoal}</p>
              </div>
              <div>
                <p className="text-gray-600">Лет на мечту</p>
                <p className="font-bold">{forecast.metadata.dreamYears} лет</p>
              </div>
            </div>
          </div>

          {/* Dream Forecast */}
          <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300">
            <h2 className="text-2xl font-bold mb-4">🌟 Прогноз достижения мечты</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Расчетное время</p>
                <p className="text-3xl font-bold text-purple-600">
                  {forecast.forecast.dreamForecast.estimatedYears.toFixed(1)} лет
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Идет по плану?</p>
                <p className={`text-3xl font-bold ${forecast.forecast.dreamForecast.onTrack ? 'text-green-600' : 'text-red-600'}`}>
                  {forecast.forecast.dreamForecast.onTrack ? '✅ Да' : '❌ Нет'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Прогресс в год</p>
                <p className="text-3xl font-bold text-blue-600">
                  {forecast.forecast.dreamForecast.dreamProgressRate.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Необходимые корректировки</h3>
              <p className="whitespace-pre-wrap">{forecast.forecast.dreamForecast.adjustmentNeeded}</p>
            </div>
          </div>

          {/* Current Period Forecast */}
          {forecast.forecast.currentPeriodForecast && (
            <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300">
              <h2 className="text-2xl font-bold mb-4">📅 Прогноз текущего периода</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Вероятность выполнения</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {forecast.forecast.currentPeriodForecast.completionProbability}%
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Ожидаемое выполнение</p>
                  <p className="text-3xl font-bold text-green-600">
                    {forecast.forecast.currentPeriodForecast.expectedCompletionRate}%
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Осталось дней</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {forecast.forecast.currentPeriodForecast.daysRemaining}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Текущий темп</p>
                  <p className={`text-2xl font-bold ${getPaceColor(forecast.forecast.currentPeriodForecast.currentPace)}`}>
                    {forecast.forecast.currentPeriodForecast.currentPace}
                  </p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Рекомендации</h3>
                <ul className="list-disc list-inside space-y-1">
                  {forecast.forecast.currentPeriodForecast.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* What If Scenarios */}
          <div className="card bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300">
            <h2 className="text-2xl font-bold mb-4">🤔 Сценарии "Что если?"</h2>
            <div className="space-y-3">
              {forecast.forecast.whatIfScenarios.map((scenario, i) => (
                <div key={i} className="bg-white p-4 rounded-lg border-l-4 border-yellow-500">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-lg">{scenario.scenario}</h3>
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${getProbabilityColor(scenario.probability)}`}>
                      {scenario.probability}
                    </span>
                  </div>
                  <p className="text-gray-700">{scenario.impact}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Key Recommendations */}
          <div className="card bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-300">
            <h2 className="text-2xl font-bold mb-4">💡 Ключевые рекомендации</h2>
            <div className="space-y-2">
              {forecast.forecast.keyRecommendations.map((rec, i) => (
                <div key={i} className="bg-white p-4 rounded-lg flex items-start gap-3">
                  <span className="text-2xl">{i + 1}.</span>
                  <p className="flex-1 text-lg">{rec}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="card bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300">
            <h2 className="text-2xl font-bold mb-4">📝 Резюме прогноза</h2>
            <div className="bg-white p-6 rounded-lg">
              <p className="whitespace-pre-wrap text-lg leading-relaxed">{forecast.forecast.summary}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
