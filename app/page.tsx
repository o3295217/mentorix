'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, startOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale'
import DreamProgress from '@/components/DreamProgress'
import ProgressIndicator from '@/components/ProgressIndicator'
import { DreamGoal, DailyEntry, ProgressStats } from '@/lib/types'

interface UserProfile {
  name?: string
}

interface WeekGoal {
  text: string
  completed: boolean
}

interface WeekGoalsResponse {
  goals: WeekGoal[]
}

// Функция для определения приветствия по времени суток
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Доброе утро'
  if (hour >= 12 && hour < 17) return 'Добрый день'
  if (hour >= 17 && hour < 22) return 'Добрый вечер'
  return 'Доброй ночи'
}

export default function HomePage() {
  const [today] = useState(new Date())
  const [dreamGoal, setDreamGoal] = useState<DreamGoal | null>(null)
  const [dailyEntry, setDailyEntry] = useState<DailyEntry | null>(null)
  const [progressStats, setProgressStats] = useState<ProgressStats | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [weekGoals, setWeekGoals] = useState<WeekGoal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const dateStr = format(today, 'yyyy-MM-dd')
      const weekStart = startOfWeek(today, { weekStartsOn: 1 })
      
      // Параллельная загрузка всех данных
      const [dreamRes, dailyRes, progressRes, profileRes, weekGoalsRes] = await Promise.all([
        fetch('/api/goals/dream'),
        fetch(`/api/daily?date=${dateStr}`),
        fetch('/api/progress'),
        fetch('/api/profile'),
        fetch(`/api/goals/period?type=week&date=${weekStart.toISOString()}`),
      ])

      if (dreamRes.ok) {
        const dream = await dreamRes.json()
        setDreamGoal(dream)
      }

      if (dailyRes.ok) {
        const daily = await dailyRes.json()
        setDailyEntry(daily)
      }

      if (progressRes.ok) {
        const progress = await progressRes.json()
        setProgressStats(progress)
      }

      if (profileRes.ok) {
        const profile = await profileRes.json()
        setUserProfile(profile)
      }

      if (weekGoalsRes.ok) {
        const weekGoalsData: WeekGoalsResponse = await weekGoalsRes.json()
        setWeekGoals(weekGoalsData.goals || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
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

  return (
    <div className="space-y-8">
      {/* Header - Персонализированное приветствие */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          {getGreeting()}{userProfile?.name ? `, ${userProfile.name}!` : '!'}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">{format(today, 'd MMMM yyyy, EEEE', { locale: ru })}</p>
      </div>

      {/* Dream Progress - ГЛАВНЫЙ ВИДЖЕТ */}
      <DreamProgress dreamGoal={dreamGoal?.goalText || ''} />

      {/* Progress Indicator */}
      {progressStats && (
        <ProgressIndicator
          productiveDays={progressStats.productiveDays}
          currentStreak={progressStats.currentStreak}
          progressPercent={progressStats.progressPercent}
          targetDays={progressStats.targetDays}
          currentSpeed={progressStats.currentSpeed}
          userName={userProfile?.name}
        />
      )}

      {/* Today's Card */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-4">Сегодняшний день</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!dailyEntry?.planText && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
              <p className="text-yellow-800 dark:text-yellow-200">План на сегодня еще не создан</p>
              <Link href="/daily" className="btn-primary mt-2 inline-block">
                Создать план
              </Link>
            </div>
          )}

          {dailyEntry?.planText && !dailyEntry?.factText && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <p className="text-blue-800 dark:text-blue-200 mb-2">План на сегодня создан</p>
              <Link href="/daily" className="btn-primary inline-block">
                Добавить факт выполнения
              </Link>
            </div>
          )}

          {dailyEntry?.factText && !dailyEntry?.evaluation && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
              <p className="text-green-800 dark:text-green-200 mb-2">План и факт заполнены</p>
              <Link href="/daily" className="btn-primary inline-block">
                Получить оценку
              </Link>
            </div>
          )}

          {dailyEntry?.evaluation && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
              <p className="text-purple-800 dark:text-purple-200 mb-2">
                Оценка за сегодня: <span className="font-bold text-2xl">{dailyEntry.evaluation.overallScore}</span>/10
              </p>
              <Link href={`/evaluation/${format(today, 'yyyy-MM-dd')}`} className="btn-primary inline-block">
                Посмотреть детали
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Цели недели */}
      {weekGoals.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Цели недели</h2>
            <Link href="/goals" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Все цели →
            </Link>
          </div>
          <div className="space-y-2">
            {weekGoals.slice(0, 5).map((goal, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-sm ${
                  goal.completed 
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                }`}>
                  {goal.completed ? '✓' : '○'}
                </span>
                <span className={`text-sm ${
                  goal.completed 
                    ? 'text-gray-500 dark:text-gray-400 line-through' 
                    : 'text-gray-800 dark:text-gray-200'
                }`}>
                  {goal.text}
                </span>
              </div>
            ))}
            {weekGoals.length > 5 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                +{weekGoals.length - 5} целей
              </p>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Выполнено: {weekGoals.filter(g => g.completed).length} из {weekGoals.length}
              </span>
              <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${(weekGoals.filter(g => g.completed).length / weekGoals.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/daily" className="card hover:shadow-lg transition-shadow">
          <h3 className="text-xl font-semibold mb-2">📝 Ежедневное планирование</h3>
          <p className="text-base text-gray-600 dark:text-gray-300">Создайте план на день и добавьте факт выполнения</p>
        </Link>

        <Link href="/goals" className="card hover:shadow-lg transition-shadow">
          <h3 className="text-xl font-semibold mb-2">🎯 Управление целями</h3>
          <p className="text-base text-gray-600 dark:text-gray-300">Установите цели на неделю, месяц, квартал и год</p>
        </Link>

        <Link href="/periods" className="card hover:shadow-lg transition-shadow bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30">
          <h3 className="text-xl font-semibold mb-2">📊 Периодические оценки</h3>
          <p className="text-base text-gray-600 dark:text-gray-300">Получите оценку недели, месяца, квартала или года от ИИ</p>
        </Link>

        <Link href="/forecast" className="card hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30">
          <h3 className="text-xl font-semibold mb-2">🔮 Прогнозы</h3>
          <p className="text-base text-gray-600 dark:text-gray-300">Узнайте прогноз достижения мечты и выполнения целей</p>
        </Link>

        <Link href="/analytics" className="card hover:shadow-lg transition-shadow">
          <h3 className="text-xl font-semibold mb-2">📈 Аналитика</h3>
          <p className="text-base text-gray-600 dark:text-gray-300">Просмотрите статистику и тренды вашей эффективности</p>
        </Link>

        <Link href="/tasks" className="card hover:shadow-lg transition-shadow">
          <h3 className="text-xl font-semibold mb-2">✅ Задачи</h3>
          <p className="text-base text-gray-600 dark:text-gray-300">Управляйте незакрытыми задачами и приоритетами</p>
        </Link>
      </div>
    </div>
  )
}
