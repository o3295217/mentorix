'use client'

import Link from 'next/link'

interface ProgressIndicatorProps {
  productiveDays: number
  currentStreak: number
  progressPercent: number
  targetDays: number
  currentSpeed?: number
  userName?: string
}

export default function ProgressIndicator({
  productiveDays,
  progressPercent,
  targetDays,
  currentSpeed = 0,
  userName = '',
}: ProgressIndicatorProps) {
  // Расчёт прогноза
  const targetYears = 5
  const remainingDays = targetDays - productiveDays
  const efficiency = currentSpeed / 10
  const yearsToGoal = efficiency > 0 ? (remainingDays / efficiency) / 365 : Infinity

  // Форматирование прогноза
  const formatYears = (years: number) => {
    if (years === Infinity || years > 100) return '∞'
    return years.toFixed(1)
  }

  const isAlert = yearsToGoal > targetYears * 1.1
  const color = isAlert ? '#dc2626' : '#10b981'

  // Имя для обращения
  const displayName = userName || 'Вы'

  return (
    <div className={`card border-2 ${isAlert ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200' : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'}`}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">🌟 Прогресс к мечте</h2>
          <Link
            href="/progress"
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
          >
            Подробнее →
          </Link>
        </div>

        {/* Главный акцент — одна строка */}
        <div className="flex items-baseline flex-wrap gap-x-2">
          <span className="text-lg text-gray-600">При текущей скорости {displayName} достигнет цель через</span>
          <span className="text-4xl font-bold" style={{ color }}>{formatYears(yearsToGoal)}</span>
          <span className="text-lg text-gray-500">лет</span>
          <span className="text-lg text-gray-400">(план: {targetYears} лет)</span>
        </div>

        {/* Прогресс-бар */}
        <div className="relative">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${isAlert ? 'bg-gradient-to-r from-red-400 to-orange-500' : 'bg-gradient-to-r from-green-400 to-emerald-500'}`}
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between text-xs text-gray-500">
          <span>{productiveDays} / {targetDays} дней</span>
          <span>{progressPercent.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}
