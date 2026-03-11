'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, startOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale'
import DreamProgress from '@/components/DreamProgress'
import ProgressIndicator from '@/components/ProgressIndicator'
import Landing from '@/components/Landing'
import { useAuth } from '@/components/AuthProvider'
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
  const { user, loading: authLoading } = useAuth()
  const [today] = useState(new Date())
  const [dreamGoal, setDreamGoal] = useState<DreamGoal | null>(null)
  const [dailyEntry, setDailyEntry] = useState<DailyEntry | null>(null)
  const [progressStats, setProgressStats] = useState<ProgressStats | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [weekGoals, setWeekGoals] = useState<WeekGoal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Загружаем данные только если пользователь авторизован
    if (user) {
      fetchData()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [user, authLoading])

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

  // Показываем загрузку пока проверяется авторизация
  if (authLoading || (user && loading)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-400">Загрузка...</div>
      </div>
    )
  }

  // Показываем Landing для неавторизованных
  if (!user) {
    return <Landing />
  }

  return (
    <div className="space-y-8">
      {/* Header - Персонализированное приветствие */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">
          {getGreeting()}{userProfile?.name ? `, ${userProfile.name}!` : '!'}
        </h1>
        <p className="text-xl text-gray-400">{format(today, 'd MMMM yyyy, EEEE', { locale: ru })}</p>
      </div>

      {/* Dream Progress - ГЛАВНЫЙ ВИДЖЕТ */}
      <DreamProgress dreamGoal={dreamGoal?.goalText || ''} years={dreamGoal?.years} />

      {/* Progress Indicator */}
      {progressStats && (
        <ProgressIndicator
          effectiveDays={progressStats.effectiveDays}
          elapsedDays={progressStats.elapsedDays}
          evaluatedDays={progressStats.evaluatedDays}
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
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
              <p className="text-yellow-200">План на сегодня еще не создан</p>
              <Link href="/daily" className="btn-primary mt-2 inline-block">
                Создать план
              </Link>
            </div>
          )}

          {dailyEntry?.planText && !dailyEntry?.factText && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
              <p className="text-blue-200 mb-2">План на сегодня создан</p>
              <Link href="/daily" className="btn-primary inline-block">
                Добавить факт выполнения
              </Link>
            </div>
          )}

          {dailyEntry?.factText && !dailyEntry?.evaluation && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
              <p className="text-green-200 mb-2">План и факт заполнены</p>
              <Link href="/daily" className="btn-primary inline-block">
                Получить оценку
              </Link>
            </div>
          )}

          {dailyEntry?.evaluation && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4">
              <p className="text-purple-200 mb-2">
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
            <Link href="/goals" className="text-sm text-blue-400 hover:underline">
              Все цели →
            </Link>
          </div>
          <div className="space-y-2">
            {weekGoals.slice(0, 5).map((goal, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-sm ${
                  goal.completed 
                    ? 'bg-green-500/15 text-green-400' 
                    : 'bg-gray-800 text-gray-500'
                }`}>
                  {goal.completed ? '✓' : '·'}
                </span>
                <span className={`text-sm ${
                  goal.completed 
                    ? 'text-gray-500 line-through' 
                    : 'text-gray-200'
                }`}>
                  {goal.text}
                </span>
              </div>
            ))}
            {weekGoals.length > 5 && (
              <p className="text-sm text-gray-500 mt-2">
                +{weekGoals.length - 5} целей
              </p>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">
                Выполнено: {weekGoals.filter(g => g.completed).length} из {weekGoals.length}
              </span>
              <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
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
        <Link href="/daily" className="card hover:border-blue-500/40 transition-all">
          <div className="w-2 h-2 rounded-full bg-blue-400 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Ежедневное планирование</h3>
          <p className="text-base text-gray-400">Создайте план на день и добавьте факт выполнения</p>
        </Link>

        <Link href="/goals" className="card hover:border-purple-500/40 transition-all">
          <div className="w-2 h-2 rounded-full bg-purple-400 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Управление целями</h3>
          <p className="text-base text-gray-400">Установите цели на неделю, месяц, квартал и год</p>
        </Link>

        <Link href="/periods" className="card hover:border-pink-500/40 transition-all">
          <div className="w-2 h-2 rounded-full bg-pink-400 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Периодические оценки</h3>
          <p className="text-base text-gray-400">Получите оценку недели, месяца, квартала или года от ИИ</p>
        </Link>

        <Link href="/forecast" className="card hover:border-cyan-500/40 transition-all">
          <div className="w-2 h-2 rounded-full bg-cyan-400 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Прогнозы</h3>
          <p className="text-base text-gray-400">Узнайте прогноз достижения мечты и выполнения целей</p>
        </Link>

        <Link href="/analytics" className="card hover:border-green-500/40 transition-all">
          <div className="w-2 h-2 rounded-full bg-green-400 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Аналитика</h3>
          <p className="text-base text-gray-400">Просмотрите статистику и тренды вашей эффективности</p>
        </Link>

        <Link href="/tasks" className="card hover:border-orange-500/40 transition-all">
          <div className="w-2 h-2 rounded-full bg-orange-400 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Задачи</h3>
          <p className="text-base text-gray-400">Управляйте незакрытыми задачами и приоритетами</p>
        </Link>
      </div>
    </div>
  )
}
