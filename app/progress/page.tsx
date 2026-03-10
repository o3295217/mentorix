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

  const level = getLevel(stats.productiveDays)

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
        <div className="text-center mb-4">
          <h2 className="font-bold text-gray-200">Скорость к мечте</h2>
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
        <div className="card text-center">
          <div className="text-3xl mb-2"></div>
          <div className="text-3xl font-bold text-blue-400">{stats.productiveDays}</div>
          <div className="text-sm text-gray-400 mt-1">дней пройдено</div>
          <div className="text-xs text-gray-500 mt-1">из {stats.targetDays}</div>
        </div>

        <div className="card text-center">
          <div className="text-3xl mb-2"></div>
          <div className="text-3xl font-bold text-green-400">{stats.fuelLevel}%</div>
          <div className="text-sm text-gray-400 mt-1">топливо (баланс)</div>
          <div className="text-xs text-gray-500 mt-1">здоровье + семья + энергия</div>
        </div>

        <div className="card text-center">
          <div className="text-3xl mb-2"></div>
          <div className="text-3xl font-bold text-purple-400">
            {milestones.filter(m => m.achieved).length}/{milestones.length}
          </div>
          <div className="text-sm text-gray-400 mt-1">вехи пройдено</div>
          <div className="text-xs text-gray-500 mt-1">достижения</div>
        </div>

        <div className="card text-center">
          <div className="text-3xl mb-2"></div>
          <div className="text-3xl font-bold text-orange-400">{stats.avgSpeed30d}</div>
          <div className="text-sm text-gray-400 mt-1">средняя скорость</div>
          <div className="text-xs text-gray-500 mt-1">за 30 дней</div>
        </div>
      </div>

      {/* Дорожная карта с вехами */}
      <div className="card">
        <h2 className="font-bold mb-6 text-gray-200">Дорожная карта</h2>

        {/* Текущий уровень */}
        <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="font-bold text-gray-200">{level.name}</div>
            {level.next && (
              <div className="text-sm text-gray-300">
                До следующего: <span className="font-bold">{level.next - stats.productiveDays}</span> дней
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
              style={{ width: `${(stats.productiveDays / 1000) * 100}%` }}
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
        <h2 className="text-xl font-bold mb-4"> Распределение дней по скоростям</h2>
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
