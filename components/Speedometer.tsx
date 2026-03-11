'use client'

import { useEffect, useState } from 'react'

interface SpeedometerProps {
  speed: number // 0-10
  maxSpeed?: number
  targetDays?: number
  effectiveDays?: number
  elapsedDays?: number
  evaluatedDays?: number
}

export default function Speedometer({ 
  speed, 
  maxSpeed = 10,
  targetDays = 1825,
  effectiveDays = 0,
  elapsedDays = 0,
  evaluatedDays = 0,
}: SpeedometerProps) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(timeout)
  }, [])

  // Целевой срок
  const targetYears = targetDays / 365

  // Два рычага
  const frequency = elapsedDays > 0 ? evaluatedDays / elapsedDays : 0   // 0..1
  const quality = speed / maxSpeed                                        // 0..1

  // Реалистичный прогноз: effectiveDays_per_calendar_day = frequency * quality
  const realRate = frequency * quality  // эфф.дней за 1 календарный день
  const remainingDays = targetDays - effectiveDays
  const calendarDaysToGoal = realRate > 0 ? remainingDays / realRate : Infinity
  const yearsToGoal = calendarDaysToGoal / 365

  // Сценарии «Что если»
  const scenarioEveryDay = quality > 0 ? (remainingDays / quality) / 365 : Infinity
  const scenarioQuality7 = frequency > 0 ? (remainingDays / (frequency * 0.7)) / 365 : Infinity
  const scenarioBoth = (remainingDays / 0.7) / 365

  // Статус
  const getStatus = (years: number) => {
    if (years === Infinity) return { color: '#dc2626', label: 'Критично' }
    if (years <= targetYears * 1.1) return { color: '#10b981', label: 'В графике' }
    if (years <= targetYears * 1.5) return { color: '#f59e0b', label: 'Отставание' }
    if (years <= targetYears * 2) return { color: '#f97316', label: 'Сильное отставание' }
    return { color: '#dc2626', label: 'Критично' }
  }

  const { color, label } = getStatus(yearsToGoal)

  // Форматирование
  const formatYears = (years: number) => {
    if (years === Infinity || years > 100) return '∞'
    if (years < 1) return `${Math.round(years * 12)} мес.`
    return years.toFixed(1)
  }

  const formatUnit = (years: number) => {
    if (years === Infinity || years > 100) return ''
    if (years < 1) return ''
    return 'лет'
  }

  const diffYears = yearsToGoal - targetYears

  // Какой рычаг важнее
  const frequencyImpact = quality > 0 ? (remainingDays / quality) / 365 : Infinity  // если freq=100%
  const qualityImpact = frequency > 0 ? (remainingDays / (frequency * 1.0)) / 365 : Infinity  // если quality=100%
  const freqMoreImportant = (yearsToGoal - frequencyImpact) > (yearsToGoal - qualityImpact)

  return (
    <div className="w-full mx-auto space-y-6">
      {/* Прогноз — компактный блок */}
      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold font-mono tracking-tight" style={{ color }}>
            {formatYears(yearsToGoal)}
          </span>
          <span className="text-sm text-gray-500">{formatUnit(yearsToGoal)}</span>
        </div>
        <div className="text-sm text-gray-500">
          план {targetYears} лет
        </div>
        <div 
          className="text-sm font-bold px-2 py-0.5 rounded-lg"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {yearsToGoal === Infinity ? label : diffYears > 0 ? `+${diffYears.toFixed(1)}` : label}
        </div>
        <div className="text-sm text-gray-500 ml-auto">
          {effectiveDays} из {targetDays} эфф. дней — <span className="font-semibold" style={{ color }}>{(effectiveDays / targetDays * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* Рычаги + Сценарии — в одну строку */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Левый столбец — рычаги */}
        <div className="space-y-4">
          {/* Частота */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm text-gray-400">Частота</span>
              <span className="text-2xl font-bold font-mono text-cyan-400">{Math.round(frequency * 100)}%</span>
            </div>
            <div className="relative h-4 rounded-full overflow-hidden bg-gray-700/60">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400"
                style={{ 
                  width: animated ? `${frequency * 100}%` : '0%',
                  transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              />
            </div>
          </div>

          {/* Качество */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm text-gray-400">Качество</span>
              <span className="text-2xl font-bold font-mono text-amber-400">{speed.toFixed(1)}<span className="text-sm text-gray-500">/10</span></span>
            </div>
            <div className="relative h-4 rounded-full overflow-hidden bg-gray-700/60">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400"
                style={{ 
                  width: animated ? `${quality * 100}%` : '0%',
                  transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              />
              <div className="absolute top-0 h-full w-px bg-gray-400/40" style={{ left: '70%' }} />
            </div>
          </div>

          {/* Совет */}
          {frequency > 0 && quality > 0 && (
            <div className="text-base text-gray-200 bg-gray-800/60 rounded-lg py-3 px-4 text-center font-medium">
              {freqMoreImportant 
                ? '↑ Работай чаще — это ускорит больше всего'
                : '↑ Подними качество дней — это ускорит больше всего'}
            </div>
          )}
        </div>

        {/* Правый столбец — сценарии */}
        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Варианты ускорения</div>
          <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-800/40">
            <span className="text-base text-gray-400">Каждый день</span>
            <span className="text-base font-bold font-mono text-cyan-400">{formatYears(scenarioEveryDay)} {formatUnit(scenarioEveryDay)}</span>
          </div>
          <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-800/40">
            <span className="text-base text-gray-400">Качество 7</span>
            <span className="text-base font-bold font-mono text-amber-400">{formatYears(scenarioQuality7)} {formatUnit(scenarioQuality7)}</span>
          </div>
          <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-emerald-900/20 border border-emerald-800/30">
            <span className="text-base text-gray-300 font-medium">Каждый день + 7</span>
            <span className="text-base font-bold font-mono text-emerald-400">{formatYears(scenarioBoth)} {formatUnit(scenarioBoth)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
