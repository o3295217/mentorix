'use client'

import { useEffect, useState } from 'react'

interface SpeedometerProps {
  speed: number // 0-10
  maxSpeed?: number
  targetDays?: number | null
  effectiveDays?: number
  elapsedDays?: number
  evaluatedDays?: number
}

// Минимум оценённых дней для показа метрик
const MIN_EVALUATED_DAYS = 3

export default function Speedometer({ 
  speed, 
  maxSpeed = 10,
  targetDays,
  effectiveDays = 0,
  elapsedDays = 0,
  evaluatedDays = 0,
}: SpeedometerProps) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(timeout)
  }, [])

  const hasHorizon = targetDays != null && targetDays > 0
  const isWarmingUp = evaluatedDays < MIN_EVALUATED_DAYS

  // Два рычага
  const frequency = elapsedDays > 0 ? evaluatedDays / elapsedDays : 0
  const quality = speed / maxSpeed

  // Целевой срок, прогноз и сценарии — только если задан горизонт
  const targetYears = hasHorizon ? targetDays / 365 : 0
  const realRate = frequency * quality
  const remainingDays = hasHorizon ? Math.max(0, targetDays - effectiveDays) : 0
  const calendarDaysToGoal = hasHorizon && realRate > 0 ? remainingDays / realRate : Infinity
  const yearsToGoal = hasHorizon ? calendarDaysToGoal / 365 : Infinity

  // Сценарии «Что если» — только при наличии горизонта
  const scenarioEveryDay = hasHorizon && quality > 0 ? (remainingDays / quality) / 365 : Infinity
  const scenarioQuality7 = hasHorizon && frequency > 0 ? (remainingDays / (frequency * 0.7)) / 365 : Infinity
  const scenarioBoth = hasHorizon ? (remainingDays / 0.7) / 365 : Infinity

  // Статус
  const getStatus = (years: number) => {
    if (!hasHorizon) return { color: '#6366f1', label: 'Горизонт не задан', tone: 'Установите срок мечты' }
    if (isWarmingUp) return { color: '#6366f1', label: 'Сбор данных', tone: 'Пока мало данных' }
    if (years === Infinity) return { color: '#dc2626', label: 'Нет устойчивого темпа', tone: 'Критическое отставание' }
    if (years <= targetYears * 1.1) return { color: '#10b981', label: 'В графике', tone: 'Хороший темп' }
    if (years <= targetYears * 1.5) return { color: '#f59e0b', label: 'Умеренное отставание', tone: 'Темп ниже плана' }
    if (years <= targetYears * 2) return { color: '#f97316', label: 'Сильное отставание', tone: 'Темп заметно ниже плана' }
    return { color: '#dc2626', label: 'Критическое отставание', tone: 'Темп слишком низкий' }
  }

  const { color, label, tone } = getStatus(yearsToGoal)

  const pluralizeYears = (value: number) => {
    const rounded = Math.round(value)
    const mod10 = rounded % 10
    const mod100 = rounded % 100

    if (mod10 === 1 && mod100 !== 11) return 'год'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'года'
    return 'лет'
  }

  const formatDuration = (years: number) => {
    if (years === Infinity || years > 100) return 'нет прогноза'
    if (years < 1) {
      const months = Math.max(1, Math.round(years * 12))
      return `${months} мес.`
    }

    const rounded = years >= 10 ? Math.round(years) : Math.round(years * 10) / 10
    return `${rounded} ${pluralizeYears(rounded)}`
  }

  const targetDuration = hasHorizon ? formatDuration(targetYears) : ''
  const forecastDuration = hasHorizon && !isWarmingUp ? formatDuration(yearsToGoal) : ''
  const effectivePercent = hasHorizon && targetDays > 0 ? (effectiveDays / targetDays) * 100 : 0
  const regularityPercent = Math.round(frequency * 100)
  const qualityScore = Math.round(speed * 10) / 10

  // Какой рычаг важнее
  const frequencyImpact = quality > 0 && hasHorizon ? (remainingDays / quality) / 365 : Infinity
  const qualityImpact = frequency > 0 && hasHorizon ? (remainingDays / frequency) / 365 : Infinity
  const freqMoreImportant = (yearsToGoal - frequencyImpact) > (yearsToGoal - qualityImpact)
  const primaryLever = freqMoreImportant ? 'регулярность' : 'качество дней'
  const leverHint = freqMoreImportant
    ? `Оценено ${evaluatedDays} из ${elapsedDays} прошедших дней`
    : 'Даже в рабочие дни среднее продвижение пока слабое'

  return (
    <div className="w-full mx-auto space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="text-sm font-semibold px-3 py-1 rounded-full"
              style={{ backgroundColor: `${color}15`, color }}
            >
              {label}
            </span>
            {hasHorizon && <span className="text-sm text-gray-500">Плановый срок: {targetDuration}</span>}
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-white leading-tight">
              {tone}
            </h2>
            {!hasHorizon ? (
              <div className="space-y-3">
                <p className="text-lg text-gray-300">
                  Чтобы рассчитать прогноз, укажите горизонт мечты (в месяцах) на странице <a href="/goals" className="text-indigo-400 hover:text-indigo-300 font-medium">Цели</a>.
                </p>
                <p className="text-sm text-gray-500">
                  Без горизонта невозможно оценить, в каком вы темпе: быстрее или медленнее плана.
                </p>
              </div>
            ) : isWarmingUp ? (
              <div className="space-y-3">
                <p className="text-lg text-gray-300">
                  Для расчёта прогноза нужно минимум <span className="font-semibold text-indigo-400">{MIN_EVALUATED_DAYS} оценённых дня</span>. Сейчас оценено: {evaluatedDays}.
                </p>
                <p className="text-sm text-gray-500">
                  Планируйте дни и получайте оценки — скоро здесь появится полный анализ.
                </p>
              </div>
            ) : (
              <>
                <p className="text-lg text-gray-300">
                  При текущем темпе цель будет достигнута примерно через{' '}
                  <span className="font-semibold" style={{ color }}>{forecastDuration}</span>.
                </p>
                <p className="text-sm text-gray-500">
                  Главный тормоз сейчас: <span className="text-gray-300 font-medium">{primaryLever}</span>.
                </p>
              </>
            )}
          </div>
        </div>

        {hasHorizon && !isWarmingUp ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Эффективный вклад</div>
              <div className="text-2xl font-bold text-white">{Math.round(effectiveDays * 10) / 10}</div>
              <div className="text-sm text-gray-500">эфф. дней из {targetDays}</div>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Доля горизонта</div>
              <div className="text-2xl font-bold" style={{ color }}>{effectivePercent.toFixed(1)}%</div>
              <div className="text-sm text-gray-500">от общего горизонта мечты</div>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4 col-span-2">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Главный вывод</div>
              <div className="text-base text-gray-200 font-medium">
                Сильнее всего сейчас влияет <span style={{ color }}>{primaryLever}</span>
              </div>
              <div className="text-sm text-gray-500 mt-1">{leverHint}</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Эффективный вклад</div>
              <div className="text-2xl font-bold text-white">{Math.round(effectiveDays * 10) / 10}</div>
              <div className="text-sm text-gray-500">эфф. дней</div>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Оценено дней</div>
              <div className="text-2xl font-bold text-indigo-400">{evaluatedDays}</div>
              <div className="text-sm text-gray-500">из {elapsedDays} прошедших</div>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4 col-span-2">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{!hasHorizon ? 'Что нужно' : 'Что дальше'}</div>
              <div className="text-base text-gray-200 font-medium">
                {!hasHorizon 
                  ? 'Задайте горизонт мечты для расчёта прогноза'
                  : `Оцените ещё ${MIN_EVALUATED_DAYS - evaluatedDays} дн. для полного анализа`
                }
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {!hasHorizon
                  ? 'Перейдите в «Цели» → отредактируйте мечту → укажите срок'
                  : 'После этого появятся прогнозы, сценарии и рекомендации'
                }
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`grid grid-cols-1 ${hasHorizon && !isWarmingUp ? 'md:grid-cols-2' : ''} gap-8`}>
        <div className="space-y-4">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm text-gray-400">Регулярность</span>
              <span className="text-2xl font-bold font-mono text-cyan-400">{regularityPercent}%</span>
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
            <div className="text-sm text-gray-500 mt-2">
              {evaluatedDays} оценённых дней из {elapsedDays} прошедших.
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm text-gray-400">Качество рабочих дней</span>
              <span className="text-2xl font-bold font-mono text-amber-400">{qualityScore}<span className="text-sm text-gray-500">/10</span></span>
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
            <div className="text-sm text-gray-500 mt-2">
              Средняя сила продвижения в последние 7 календарных дней.
            </div>
          </div>

          <div className="text-base text-gray-200 bg-gray-800/60 rounded-lg py-4 px-4 font-medium">
            {isWarmingUp
              ? `Оцените ещё ${MIN_EVALUATED_DAYS - evaluatedDays} дн., чтобы увидеть рекомендации.`
              : `Главный рычаг сейчас: ${freqMoreImportant ? 'работать чаще' : 'поднять качество дней'}.`
            }
          </div>
        </div>

        {hasHorizon && !isWarmingUp && (
          <div className="space-y-2">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Сценарии</div>
            <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-800/40 gap-4">
              <div>
                <div className="text-base text-gray-300">Если работать каждый день</div>
                <div className="text-sm text-gray-500">качество останется на текущем уровне</div>
              </div>
              <span className="text-base font-bold font-mono text-cyan-400 whitespace-nowrap">{formatDuration(scenarioEveryDay)}</span>
            </div>
            <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-800/40 gap-4">
              <div>
                <div className="text-base text-gray-300">Если поднять качество до 7/10</div>
                <div className="text-sm text-gray-500">регулярность останется текущей</div>
              </div>
              <span className="text-base font-bold font-mono text-amber-400 whitespace-nowrap">{formatDuration(scenarioQuality7)}</span>
            </div>
            <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-emerald-900/20 border border-emerald-800/30 gap-4">
              <div>
                <div className="text-base text-gray-200 font-medium">Если работать каждый день и держать 7/10</div>
                <div className="text-sm text-gray-500">реалистичный ориентир для ускорения</div>
              </div>
              <span className="text-base font-bold font-mono text-emerald-400 whitespace-nowrap">{formatDuration(scenarioBoth)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
