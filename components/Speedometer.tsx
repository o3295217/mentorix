'use client'

import { useEffect, useState } from 'react'

interface SpeedometerProps {
  speed: number // 0-10
  maxSpeed?: number
  progressPercent?: number // текущий прогресс к мечте в %
  targetDays?: number // целевое количество дней
  productiveDays?: number // сколько уже прошли
}

export default function Speedometer({ 
  speed, 
  maxSpeed = 10,
  progressPercent = 0,
  targetDays = 1825,
  productiveDays = 0
}: SpeedometerProps) {
  const [animatedSpeed, setAnimatedSpeed] = useState(0)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setAnimatedSpeed(speed)
    }, 100)
    return () => clearTimeout(timeout)
  }, [speed])

  const percentage = (animatedSpeed / maxSpeed) * 100

  // Расчёт прогноза
  const remainingProductiveDays = targetDays - productiveDays
  const efficiency = speed / maxSpeed
  const daysToGoal = efficiency > 0 
    ? Math.ceil(remainingProductiveDays / efficiency) 
    : Infinity
  const yearsToGoal = daysToGoal / 365

  // Целевой срок в годах
  const targetYears = 5

  // Статус относительно плана (сравниваем прогноз с целью)
  const getStatus = (years: number) => {
    if (years === Infinity) return { color: '#dc2626', bg: 'from-red-500 to-red-600', label: 'Критично', emoji: '🚨' }
    if (years <= targetYears * 1.1) return { color: '#10b981', bg: 'from-emerald-400 to-emerald-500', label: 'В графике', emoji: '🚀' }
    if (years <= targetYears * 1.5) return { color: '#f59e0b', bg: 'from-amber-400 to-amber-500', label: 'Отставание', emoji: '⚠️' }
    if (years <= targetYears * 2) return { color: '#f97316', bg: 'from-orange-500 to-orange-600', label: 'Сильное отставание', emoji: '🔶' }
    return { color: '#dc2626', bg: 'from-red-500 to-red-600', label: 'Критично', emoji: '🚨' }
  }

  const { color, bg, label, emoji } = getStatus(yearsToGoal)

  // Форматирование прогноза
  const formatForecast = (days: number) => {
    if (days === Infinity || days > 36500) return { value: '∞', unit: '' }
    const years = days / 365
    if (years < 1) {
      const months = Math.round(years * 12)
      return { value: months.toString(), unit: months === 1 ? 'месяц' : months < 5 ? 'месяца' : 'месяцев' }
    }
    return { value: years.toFixed(1), unit: 'лет' }
  }

  const forecast = formatForecast(daysToGoal)

  // Разница с планом
  const diffYears = yearsToGoal - targetYears
  const diffText = diffYears > 0 ? `+${diffYears.toFixed(1)} лет` : `${diffYears.toFixed(1)} лет`

  // Упрощённо: нужная скорость = оставшиеся_дни / оставшееся_время * 10
  const daysElapsed = productiveDays > 0 ? productiveDays / efficiency : 0
  const targetDaysRemaining = targetYears * 365 - daysElapsed
  const neededSpeed = targetDaysRemaining > 0 
    ? Math.min(10, Math.max(0, (remainingProductiveDays / targetDaysRemaining) * 10))
    : 10

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Главный блок — ПРОГНОЗ */}
      <div className="text-center mb-6">
        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 font-medium">
          Прогноз достижения мечты
        </div>
        <div className="text-7xl font-bold font-mono tracking-tight" style={{ color }}>
          {forecast.value}
        </div>
        <div className="text-lg text-gray-500 dark:text-gray-400">{forecast.unit}</div>
        
        {/* Сравнение с планом */}
        <div className="mt-3 flex items-center justify-center gap-3">
          <div className="text-sm text-gray-400 dark:text-gray-400">
            План: <span className="font-semibold text-gray-600 dark:text-gray-300">{targetYears} лет</span>
          </div>
          <div 
            className="text-sm font-bold px-2 py-0.5 rounded"
            style={{ 
              backgroundColor: `${color}15`,
              color: color
            }}
          >
            {diffYears > 0 ? diffText : '✓ Успеваем'}
          </div>
        </div>
      </div>

      {/* Статус */}
      <div 
        className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl mx-auto w-fit mb-6" 
        style={{ backgroundColor: `${color}15` }}
      >
        <span className="text-xl">{emoji}</span>
        <span className="text-base font-semibold" style={{ color }}>{label}</span>
      </div>

      {/* Текущая скорость */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">Текущая скорость</span>
          <span className="text-2xl font-bold font-mono" style={{ color }}>{speed.toFixed(1)}</span>
        </div>

        {/* Прогресс-бар */}
        <div className="relative mb-2">
          <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
            <div className="w-[40%] bg-red-200" />
            <div className="w-[30%] bg-amber-200" />
            <div className="w-[30%] bg-emerald-200" />
          </div>
          
          <div 
            className={`absolute top-0 left-0 h-2.5 rounded-full bg-gradient-to-r ${bg}`}
            style={{ 
              width: `${percentage}%`,
              transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          />
          
          {/* Маркер нужной скорости */}
          {neededSpeed > 0 && neededSpeed <= 10 && (
            <div 
              className="absolute top-1/2 w-0.5 h-5 bg-gray-800 dark:bg-gray-200 rounded"
              style={{ 
                left: `${(neededSpeed / maxSpeed) * 100}%`,
                transform: 'translate(-50%, -50%)'
              }}
              title={`Нужно: ${neededSpeed.toFixed(1)}`}
            />
          )}
        </div>

        <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
          <span>0</span>
          <span>4</span>
          <span>7</span>
          <span>10</span>
        </div>

        {/* Подсказка о нужной скорости */}
        {diffYears > 0 && neededSpeed <= 10 && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Чтобы уложиться в {targetYears} лет, нужна скорость{' '}
              <span className="font-bold text-gray-700 dark:text-gray-200">{neededSpeed.toFixed(1)}</span>
            </span>
          </div>
        )}
      </div>

      {/* Прогресс к мечте */}
      <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-500 dark:text-gray-400">Прогресс к мечте</span>
          <span className="font-medium text-gray-700 dark:text-gray-200">{productiveDays} / {targetDays} дней</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div 
            className="h-1.5 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="text-right text-xs text-gray-400 dark:text-gray-500 mt-1">{progressPercent.toFixed(1)}%</div>
      </div>
    </div>
  )
}
