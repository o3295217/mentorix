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
        <div className="text-lg text-gray-600">Загрузка...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Ошибка загрузки</h2>
        <p className="text-gray-600">Не удалось загрузить статистику прогресса</p>
      </div>
    )
  }

  // Определение уровня
  const getLevel = (days: number) => {
    if (days >= 1000) return { name: '🏆 Легенда', next: null, progress: 100 }
    if (days >= 365) return { name: '⭐ Мастер', next: 1000, progress: ((days - 365) / (1000 - 365)) * 100 }
    if (days >= 100) return { name: '💪 Эксперт', next: 365, progress: ((days - 100) / (365 - 100)) * 100 }
    if (days >= 30) return { name: '🌱 Практик', next: 100, progress: ((days - 30) / (100 - 30)) * 100 }
    if (days >= 10) return { name: '🚀 Новичок+', next: 30, progress: ((days - 10) / (30 - 10)) * 100 }
    return { name: '🔰 Новичок', next: 10, progress: (days / 10) * 100 }
  }

  const level = getLevel(stats.productiveDays)

  // Список вех
  const milestones = [
    { days: 10, label: 'Первые шаги', icon: '🎯', achieved: stats.milestones['10'] },
    { days: 30, label: 'Месяц силы', icon: '💪', achieved: stats.milestones['30'] },
    { days: 100, label: 'Сотня', icon: '💯', achieved: stats.milestones['100'] },
    { days: 365, label: 'Годовщина', icon: '🎂', achieved: stats.milestones['365'] },
    { days: 1000, label: 'Тысяча', icon: '🏆', achieved: stats.milestones['1000'] },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">🚗 Путешествие к мечте</h1>
        <Link href="/" className="btn-secondary">
          ← Назад
        </Link>
      </div>

      {/* Спидометр - центральный элемент */}
      <div className="card bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/30 border-slate-200 dark:border-slate-700">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">Скорость к мечте</h2>
        </div>
        <Speedometer 
          speed={stats.currentSpeed}
          progressPercent={stats.progressPercent}
          targetDays={stats.targetDays}
          productiveDays={stats.productiveDays}
        />
      </div>

      {/* Dashboard метрик */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card text-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/30">
          <div className="text-3xl mb-2">🛣️</div>
          <div className="text-3xl font-bold text-blue-600">{stats.productiveDays}</div>
          <div className="text-sm text-gray-600 mt-1">дней пройдено</div>
          <div className="text-xs text-gray-500 mt-1">из {stats.targetDays}</div>
        </div>

        <div className="card text-center bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/30">
          <div className="text-3xl mb-2">⛽</div>
          <div className="text-3xl font-bold text-green-600">{stats.fuelLevel}%</div>
          <div className="text-sm text-gray-600 mt-1">топливо (баланс)</div>
          <div className="text-xs text-gray-500 mt-1">здоровье + семья + энергия</div>
        </div>

        <div className="card text-center bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/30">
          <div className="text-3xl mb-2">🎯</div>
          <div className="text-3xl font-bold text-purple-600">
            {milestones.filter(m => m.achieved).length}/{milestones.length}
          </div>
          <div className="text-sm text-gray-600 mt-1">вехи пройдено</div>
          <div className="text-xs text-gray-500 mt-1">достижения</div>
        </div>

        <div className="card text-center bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/30">
          <div className="text-3xl mb-2">📊</div>
          <div className="text-3xl font-bold text-orange-600">{stats.avgSpeed30d}</div>
          <div className="text-sm text-gray-600 mt-1">средняя скорость</div>
          <div className="text-xs text-gray-500 mt-1">за 30 дней</div>
        </div>
      </div>

      {/* Дорожная карта с вехами */}
      <div className="card bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30">
        <h2 className="text-2xl font-bold mb-6 text-indigo-900 dark:text-indigo-200">🗺️ Дорожная карта</h2>

        {/* Текущий уровень */}
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-indigo-200 dark:border-indigo-700">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xl font-bold text-indigo-900 dark:text-indigo-200">{level.name}</div>
            {level.next && (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                До следующего: <span className="font-bold">{level.next - stats.productiveDays}</span> дней
              </div>
            )}
          </div>
          {level.next && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-500"
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
                      ? 'bg-green-100 border-green-500'
                      : 'bg-gray-100 border-gray-300'
                  }`}
                >
                  {milestone.achieved ? '✅' : milestone.icon}
                </div>
                <div className="text-xs font-medium mt-2 text-center">{milestone.label}</div>
                <div className="text-xs text-gray-500">{milestone.days} дней</div>
              </div>
            ))}
          </div>
          {/* Линия между вехами */}
          <div className="absolute top-6 left-0 right-0 h-1 bg-gray-300 -z-10" style={{ width: 'calc(100% - 48px)', marginLeft: '24px' }}>
            <div
              className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500"
              style={{ width: `${(stats.productiveDays / 1000) * 100}%` }}
            />
          </div>
        </div>

        {/* Разблокированные достижения */}
        {milestones.filter(m => m.achieved).length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-gray-700 mb-3">🏅 Разблокированные достижения:</h3>
            <div className="flex flex-wrap gap-2">
              {milestones.filter(m => m.achieved).map((m, idx) => (
                <div key={idx} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  {m.icon} {m.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Распределение по скоростям */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">📈 Распределение дней по скоростям</h2>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-green-700 font-medium">🟢 Отлично (7-10)</span>
              <span className="text-gray-600">{stats.distribution.excellent} дней ({((stats.distribution.excellent / stats.totalDays) * 100).toFixed(1)}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-green-500 h-4 rounded-full"
                style={{ width: `${(stats.distribution.excellent / stats.totalDays) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-yellow-700 font-medium">🟡 Средне (4-6)</span>
              <span className="text-gray-600">{stats.distribution.medium} дней ({((stats.distribution.medium / stats.totalDays) * 100).toFixed(1)}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-yellow-500 h-4 rounded-full"
                style={{ width: `${(stats.distribution.medium / stats.totalDays) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-red-700 font-medium">🔴 Плохо (1-3)</span>
              <span className="text-gray-600">{stats.distribution.poor} дней ({((stats.distribution.poor / stats.totalDays) * 100).toFixed(1)}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
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
