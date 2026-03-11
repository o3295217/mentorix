'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Speedometer from '@/components/Speedometer'
import { ProgressStats } from '@/lib/types'

export default function ProgressPage() {
  const [stats, setStats] = useState<ProgressStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/progress')
      if (!res.ok) {
        console.error('Failed to load progress stats:', res.status)
        return
      }
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching progress stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-400">Загрузка...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Ошибка загрузки</h2>
        <p className="text-gray-400">Не удалось загрузить статистику прогресса</p>
      </div>
    )
  }

  // Проверка на отсутствие данных для анализа
  if (!stats.distribution || stats.totalDays === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold"> Путешествие к мечте</h1>
          <Link href="/" className="btn-secondary">
            ← Назад
          </Link>
        </div>
        
        <div className="card text-center py-16">
          <div className="text-6xl mb-6"></div>
          <h2 className="text-2xl font-bold mb-4 text-gray-200">
            Ваше путешествие только начинается!
          </h2>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Здесь будет отображаться ваш прогресс к целям. 
            Начните с планирования дня и оценки его результатов.
          </p>
          <div className="space-y-3 text-left max-w-sm mx-auto mb-8">
            <div className="flex items-center gap-3 text-gray-300">
              <span className="text-2xl">1</span>
              <span>Опишите свою мечту в Профиле</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <span className="text-2xl">2</span>
              <span>Поставьте цели в разделе «Цели»</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <span className="text-2xl">3</span>
              <span>Планируйте задачи на день</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <span className="text-2xl">4</span>
              <span>Оценивайте прошедший день</span>
            </div>
          </div>
          <Link href="/daily" className="btn-primary inline-block">
            Начать планирование →
          </Link>
        </div>
      </div>
    )
  }

  // Определение уровня
  const getLevel = (days: number) => {
    if (days >= 1000) return { name: 'Легенда', next: null, progress: 100 }
    if (days >= 365) return { name: 'Мастер', next: 1000, progress: ((days - 365) / (1000 - 365)) * 100 }
    if (days >= 100) return { name: 'Эксперт', next: 365, progress: ((days - 100) / (365 - 100)) * 100 }
    if (days >= 30) return { name: 'Практик', next: 100, progress: ((days - 30) / (100 - 30)) * 100 }
    if (days >= 10) return { name: 'Новичок+', next: 30, progress: ((days - 10) / (30 - 10)) * 100 }
    return { name: 'Новичок', next: 10, progress: (days / 10) * 100 }
  }

  const level = getLevel(stats.totalDays)

  // Список вех
  const milestones = [
    { days: 10, label: 'Первые шаги', icon: '10', achieved: stats.milestones['10'] },
    { days: 30, label: 'Месяц силы', icon: '30', achieved: stats.milestones['30'] },
    { days: 100, label: 'Сотня', icon: '100', achieved: stats.milestones['100'] },
    { days: 365, label: 'Годовщина', icon: '365', achieved: stats.milestones['365'] },
    { days: 1000, label: 'Тысяча', icon: '1K', achieved: stats.milestones['1000'] },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold"> Путешествие к мечте</h1>
        <Link href="/" className="btn-secondary">
          ← Назад
        </Link>
      </div>

      {/* Спидометр - центральный элемент */}
      <div className="card">
        <Speedometer 
          speed={stats.currentSpeed}
          targetDays={stats.targetDays}
          effectiveDays={stats.effectiveDays}
          elapsedDays={stats.elapsedDays}
          evaluatedDays={stats.evaluatedDays}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-4">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-3">Прогресс к мечте</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-gray-800/60 rounded-lg py-3 px-2 text-center border border-gray-700/50">
              <div className="text-2xl font-bold text-blue-400">{stats.elapsedDays}</div>
              <div className="text-xs text-gray-500">прошло дней</div>
            </div>
            <div className="bg-gray-800/60 rounded-lg py-3 px-2 text-center border border-gray-700/50">
              <div className="text-2xl font-bold text-violet-400">{stats.plannedDays}</div>
              <div className="text-xs text-gray-500">запланировано</div>
            </div>
            <div className="bg-gray-800/60 rounded-lg py-3 px-2 text-center border border-gray-700/50">
              <div className="text-2xl font-bold text-cyan-400">{stats.evaluatedDays}</div>
              <div className="text-xs text-gray-500">оценено ИИ</div>
            </div>
            <div className="bg-gray-800/60 rounded-lg py-3 px-2 text-center border border-gray-700/50">
              <div className="text-2xl font-bold text-emerald-400">{stats.effectiveDays}</div>
              <div className="text-xs text-gray-500">эфф. вклад</div>
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-500">
            Воронка прогресса: календарные дни → запланированные дни → оценённые дни → эффективный вклад.
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-3">Прогресс дисциплины</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800/60 rounded-lg py-3 px-2 text-center border border-gray-700/50">
              <div className="text-2xl font-bold text-amber-400">{stats.currentStreak}</div>
              <div className="text-xs text-gray-500">серия сейчас</div>
            </div>
            <div className="bg-gray-800/60 rounded-lg py-3 px-2 text-center border border-gray-700/50">
              <div className="text-2xl font-bold text-orange-400">{stats.longestStreak}</div>
              <div className="text-xs text-gray-500">лучшая серия</div>
            </div>
            <div className="bg-gray-800/60 rounded-lg py-3 px-2 text-center border border-gray-700/50 col-span-2">
              <div className="text-sm text-gray-500 mb-1">Текущее состояние</div>
              <div className="flex items-center justify-center gap-4 text-sm text-gray-300 flex-wrap">
                <span>Баланс жизни: {stats.fuelLevel}%</span>
                <span>Средний темп 30д: {stats.avgSpeed30d}/10</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Дорожная карта с вехами */}
      <div className="card">
        <div className="mb-6">
          <h2 className="font-bold text-gray-200">Дорожная карта дисциплины</h2>
          <p className="text-sm text-gray-500 mt-1">Вехи по количеству оценённых дней, а не по прогрессу к мечте.</p>
        </div>

        {/* Текущий уровень */}
        <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="font-bold text-gray-200">{level.name}</div>
            {level.next && (
              <div className="text-sm text-gray-300">
                До следующего: <span className="font-bold">{level.next - stats.totalDays}</span> дней
              </div>
            )}
          </div>
          {level.next && (
            <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full transition-all duration-500"
                style={{ width: `${level.progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Линия прогресса с вехами */}
        <div className="relative">
          <div className="flex justify-between items-center">
            {milestones.map((milestone, idx) => (
              <div key={idx} className="flex flex-col items-center flex-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border-4 transition-all ${
                    milestone.achieved
                      ? 'bg-green-900/40 border-green-500 text-green-400'
                      : 'bg-gray-800 border-gray-600 text-gray-400'
                  }`}
                >
                  {milestone.achieved ? '✓' : milestone.icon}
                </div>
                <div className="text-xs font-medium mt-2 text-center">{milestone.label}</div>
                <div className="text-xs text-gray-500">{milestone.days} дней</div>
              </div>
            ))}
          </div>
          {/* Линия между вехами */}
          <div className="absolute top-6 left-0 right-0 h-1 bg-gray-700 -z-10" style={{ width: 'calc(100% - 48px)', marginLeft: '24px' }}>
            <div
              className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500"
              style={{ width: `${(() => {
                const days = stats.totalDays
                const thresholds = [0, 10, 30, 100, 365, 1000]
                let segmentIndex = 0
                for (let i = 1; i < thresholds.length; i++) {
                  if (days >= thresholds[i]) segmentIndex = i
                  else break
                }
                const segmentWidth = 100 / (thresholds.length - 1)
                if (segmentIndex >= thresholds.length - 1) return 100
                const low = thresholds[segmentIndex]
                const high = thresholds[segmentIndex + 1]
                const fraction = (days - low) / (high - low)
                return segmentIndex * segmentWidth + fraction * segmentWidth
              })()}%` }}
            />
          </div>
        </div>

        {/* Разблокированные достижения */}
        {milestones.filter(m => m.achieved).length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-gray-300 mb-3">Разблокированные достижения:</h3>
            <div className="flex flex-wrap gap-2">
              {milestones.filter(m => m.achieved).map((m, idx) => (
                <div key={idx} className="px-3 py-1 bg-green-900/30 text-green-400 rounded-full text-sm font-medium border border-green-800/40">
                  {m.icon} {m.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Распределение по скоростям */}
      <div className="card">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Распределение оценённых дней по качеству</h2>
          <p className="text-sm text-gray-500 mt-1">Показывает только дни, которые уже были оценены ИИ.</p>
        </div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-green-400 font-medium">🟢 Отлично (7-10)</span>
              <span className="text-gray-400">{stats.distribution.excellent} дней ({((stats.distribution.excellent / stats.totalDays) * 100).toFixed(1)}%)</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4">
              <div
                className="bg-green-500 h-4 rounded-full"
                style={{ width: `${(stats.distribution.excellent / stats.totalDays) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-yellow-400 font-medium">🟡 Средне (4-6)</span>
              <span className="text-gray-400">{stats.distribution.medium} дней ({((stats.distribution.medium / stats.totalDays) * 100).toFixed(1)}%)</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4">
              <div
                className="bg-yellow-500 h-4 rounded-full"
                style={{ width: `${(stats.distribution.medium / stats.totalDays) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-red-400 font-medium"> Плохо (1-3)</span>
              <span className="text-gray-400">{stats.distribution.poor} дней ({((stats.distribution.poor / stats.totalDays) * 100).toFixed(1)}%)</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4">
              <div
                className="bg-red-500 h-4 rounded-full"
                style={{ width: `${(stats.distribution.poor / stats.totalDays) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
