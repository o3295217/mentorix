'use client'

import Link from 'next/link'

interface ProgressIndicatorProps {
  effectiveDays: number
  elapsedDays: number
  evaluatedDays: number
  currentStreak: number
  progressPercent: number
  targetDays: number
  currentSpeed?: number
  userName?: string
}

export default function ProgressIndicator({
  effectiveDays,
  elapsedDays,
  evaluatedDays,
  progressPercent,
  targetDays,
  currentSpeed = 0,
  userName = '',
}: ProgressIndicatorProps) {
  // Расчёт прогноза
  const targetYears = 5
  const remainingDays = targetDays - effectiveDays
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
    <div className={`card border-2 ${isAlert ? 'bg-gradient-to-r from-red-950/30 to-orange-950/30 border-red-900' : 'bg-gradient-to-r from-green-950/30 to-emerald-950/30 border-green-900'}`}> 
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-100"> Прогресс к мечте</h2>
          <Link
            href="/progress"
            className="text-base text-blue-400 hover:text-blue-400 hover:underline font-medium"
          >
            Подробнее →
          </Link>
        </div>

        {/* Главный акцент — одна строка */}
        <div className="flex items-baseline flex-wrap gap-x-2">
          <span className="text-lg text-gray-300">При текущей скорости {displayName} достигнет цель через</span>
          <span className="text-4xl font-bold" style={{ color }}>{formatYears(yearsToGoal)}</span>
          <span className="text-lg text-gray-400">лет.</span>
          <span className="text-lg text-gray-300">План:</span>
          <span className="text-4xl font-bold text-gray-200">{targetYears}</span>
          <span className="text-lg text-gray-400">лет</span>
        </div>

        {/* Прогресс-бар */}
        <div className="relative">
          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${isAlert ? 'bg-gradient-to-r from-red-400 to-orange-500' : 'bg-gradient-to-r from-green-400 to-emerald-500'}`}
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between text-base text-gray-400">
          <span>{elapsedDays} прошло · {evaluatedDays} оценено · {effectiveDays.toFixed(1)} эфф.</span>
          <span>{progressPercent.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}
