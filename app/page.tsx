'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
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

const WORK_ZONES = [
  {
    href: '/daily',
    title: 'Ежедневное планирование',
    description: 'Собери день, доведи до факта и получи оценку.',
    accent: 'sky',
    eyebrow: 'Ритм',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" /></svg>
    ),
  },
  {
    href: '/goals',
    title: 'Управление целями',
    description: 'Вертикаль от мечты до недели.',
    accent: 'fuchsia',
    eyebrow: 'Система',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" /></svg>
    ),
  },
  {
    href: '/periods',
    title: 'Периодические оценки',
    description: 'Системный срез: неделя, месяц, квартал, год.',
    accent: 'pink',
    eyebrow: 'Рефлексия',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
    ),
  },
  {
    href: '/forecast',
    title: 'Прогнозы',
    description: 'К чему ведёт текущий темп.',
    accent: 'cyan',
    eyebrow: 'Траектория',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" /></svg>
    ),
  },
  {
    href: '/analytics',
    title: 'Аналитика',
    description: 'Тренды эффективности и баланса.',
    accent: 'emerald',
    eyebrow: 'Данные',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" /></svg>
    ),
  },
  {
    href: '/tasks',
    title: 'Задачи',
    description: 'Незакрытые задачи и хвост обязательств.',
    accent: 'orange',
    eyebrow: 'Контроль',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
    ),
  },
] as const

// Функция для определения приветствия по времени суток
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Доброе утро'
  if (hour >= 12 && hour < 17) return 'Добрый день'
  if (hour >= 17 && hour < 22) return 'Добрый вечер'
  return 'Доброй ночи'
}

function getDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export default function HomePage() {
  const { user, loading: authLoading } = useAuth()
  const [today, setToday] = useState(() => new Date())
  const [dreamGoal, setDreamGoal] = useState<DreamGoal | null>(null)
  const [dailyEntry, setDailyEntry] = useState<DailyEntry | null>(null)
  const [progressStats, setProgressStats] = useState<ProgressStats | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [weekGoals, setWeekGoals] = useState<WeekGoal[]>([])
  const [loading, setLoading] = useState(true)

  const weekCompleted = useMemo(() => weekGoals.filter((goal) => goal.completed).length, [weekGoals])
  const weekCompletionPercent = weekGoals.length > 0 ? Math.round((weekCompleted / weekGoals.length) * 100) : 0
  const workZones = useMemo(() => WORK_ZONES, [])

  const todayCard = useMemo(() => {
    if (!dailyEntry?.planText) {
      return {
        eyebrow: 'Ритм текущего дня',
        title: 'День ещё не запущен',
        description: 'Соберите план на день, чтобы запустить прогресс.',
        cta: 'Создать план',
        href: '/daily',
        accent: 'from-amber-500/18 via-orange-500/10 to-transparent border-amber-500/25 text-amber-200',
        step: 0,
      }
    }

    if (!dailyEntry.factText) {
      return {
        eyebrow: 'Ритм текущего дня',
        title: 'План есть — закройте фактом',
        description: 'Зафиксируйте реальное выполнение.',
        cta: 'Добавить факт',
        href: '/daily',
        accent: 'from-sky-500/18 via-cyan-500/10 to-transparent border-sky-500/25 text-sky-200',
        step: 1,
      }
    }

    if (!dailyEntry.evaluation) {
      return {
        eyebrow: 'Ритм текущего дня',
        title: 'Факт заполнен — получите оценку',
        description: 'Оценка ИИ встроит день в прогноз к мечте.',
        cta: 'Получить оценку',
        href: '/daily',
        accent: 'from-emerald-500/18 via-teal-500/10 to-transparent border-emerald-500/25 text-emerald-200',
        step: 2,
      }
    }

    return {
      eyebrow: 'Ритм текущего дня',
      title: `Оценка ${dailyEntry.evaluation.overallScore}/10`,
      description: 'День закрыт: план, факт и оценка на месте.',
      cta: 'Детали дня',
      href: `/evaluation/${format(today, 'yyyy-MM-dd')}`,
      accent: 'from-fuchsia-500/18 via-pink-500/10 to-transparent border-fuchsia-500/25 text-fuchsia-200',
      step: 3,
    }
  }, [dailyEntry, today])

  const fetchData = useCallback(async () => {
    try {
      const dateStr = getDateKey(today)
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
  }, [today])

  useEffect(() => {
    const refreshToday = () => {
      const nextToday = new Date()
      setToday((currentToday) => (getDateKey(currentToday) === getDateKey(nextToday) ? currentToday : nextToday))
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshToday()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', refreshToday)
    const intervalId = window.setInterval(refreshToday, 60 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', refreshToday)
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    // Загружаем данные только если пользователь авторизован
    if (user) {
      fetchData()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [user, authLoading, fetchData])

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
      {/* Приветствие */}
      <div className="text-center space-y-1">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
          {getGreeting()}{userProfile?.name ? `, ${userProfile.name}` : ''}
        </h1>
        <p className="text-base font-medium text-slate-500">{format(today, 'd MMMM yyyy, EEEE', { locale: ru })}</p>
      </div>

      {/* Секция 1: Мечта + Прогресс — симметричный 50/50 */}
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <DreamProgress dreamGoal={dreamGoal?.goalText || ''} months={dreamGoal?.months} />

        {progressStats ? (
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
        ) : (
          <div className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-6 flex items-center justify-center">
            <p className="text-slate-500 text-center">Данные прогресса появятся после первых оценённых дней.</p>
          </div>
        )}
      </div>

      {/* Секция 2: День + Цели недели — симметричный 50/50 */}
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        {/* Карточка дня со степ-индикатором */}
        <div className={`relative overflow-hidden rounded-[28px] border bg-gradient-to-br ${todayCard.accent} p-6 shadow-[0_18px_60px_rgba(2,6,23,0.24)] flex flex-col`}>
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-400/10">
                <svg className="h-5 w-5 text-sky-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" /></svg>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">{todayCard.eyebrow}</div>
                <h2 className="text-lg font-semibold tracking-tight text-white">{todayCard.title}</h2>
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2">
              {['План', 'Факт', 'Оценка'].map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    i < todayCard.step
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : i === todayCard.step && todayCard.step < 3
                      ? 'bg-white/10 text-white border border-white/30 ring-2 ring-white/10'
                      : 'bg-slate-800/50 text-slate-600 border border-slate-700/50'
                  }`}>
                    {i < todayCard.step ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs font-medium ${
                    i < todayCard.step ? 'text-emerald-300/70' : i === todayCard.step && todayCard.step < 3 ? 'text-slate-200' : 'text-slate-600'
                  }`}>{label}</span>
                  {i < 2 && <div className={`h-px w-4 ${i < todayCard.step ? 'bg-emerald-500/40' : 'bg-slate-700/50'}`} />}
                </div>
              ))}
            </div>

            <p className="text-sm text-slate-300 leading-6">{todayCard.description}</p>
          </div>

          <div className="flex items-center gap-3 mt-5">
            <Link href={todayCard.href} className="inline-flex min-h-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-2 text-sm font-semibold text-white transition hover:from-blue-500 hover:to-blue-400">
              {todayCard.cta}
            </Link>
            <Link href="/daily" className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-600 bg-slate-900/80 px-6 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white">
              Открыть день →
            </Link>
          </div>
        </div>

        {/* Цели недели */}
        <div className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-6 shadow-[0_18px_60px_rgba(2,6,23,0.28)] flex flex-col">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-400/10">
                <svg className="h-5 w-5 text-violet-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" /></svg>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Недельный фокус</div>
                <h2 className="text-lg font-semibold tracking-tight text-white">Цели недели</h2>
              </div>
            </div>
            <Link href="/goals" className="text-sm font-semibold text-sky-300 hover:text-sky-200">
              Все цели →
            </Link>
          </div>

          {weekGoals.length > 0 ? (
            <div className="flex-1 flex flex-col">
              <div className="mb-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-center">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Всего</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight text-white">{weekGoals.length}</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-center">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Сделано</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight text-emerald-300">{weekCompleted}</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-center">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Прогресс</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight text-cyan-300">{weekCompletionPercent}%</div>
                </div>
              </div>

              <div className="flex-1 space-y-2">
                {weekGoals.slice(0, 4).map((goal, index) => (
                  <div key={index} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-2.5">
                    <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs ${goal.completed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                      {goal.completed ? '✓' : '·'}
                    </span>
                    <span className={`${goal.completed ? 'text-slate-500 line-through' : 'text-slate-200'} text-sm leading-5 line-clamp-1`}>
                      {goal.text}
                    </span>
                  </div>
                ))}
              </div>

              {weekGoals.length > 4 && (
                <div className="mt-3 text-sm text-slate-500">Ещё {weekGoals.length - 4} →</div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/35 p-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800/50">
                <svg className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </div>
              <div className="text-base font-semibold text-slate-300 mb-1">Неделя без вектора</div>
              <div className="text-sm text-slate-500 leading-6 mb-4 max-w-xs">Задайте 1–3 цели, чтобы дневные действия не были случайными.</div>
              <Link href="/goals" className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-violet-500 px-5 py-2 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-violet-400">
                Задать цели →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Секция 3: Рабочие зоны — симметричная сетка 3x2 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-white">Рабочие зоны</h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {workZones.map((zone) => {
            const colorMap = {
              sky: { border: 'hover:border-sky-500/40', glow: 'rgba(14,165,233,0.12)', bg: 'bg-sky-500/10 text-sky-300' },
              fuchsia: { border: 'hover:border-fuchsia-500/40', glow: 'rgba(217,70,239,0.12)', bg: 'bg-fuchsia-500/10 text-fuchsia-300' },
              pink: { border: 'hover:border-pink-500/40', glow: 'rgba(236,72,153,0.12)', bg: 'bg-pink-500/10 text-pink-300' },
              cyan: { border: 'hover:border-cyan-500/40', glow: 'rgba(34,211,238,0.12)', bg: 'bg-cyan-500/10 text-cyan-300' },
              emerald: { border: 'hover:border-emerald-500/40', glow: 'rgba(16,185,129,0.12)', bg: 'bg-emerald-500/10 text-emerald-300' },
              orange: { border: 'hover:border-orange-500/40', glow: 'rgba(249,115,22,0.12)', bg: 'bg-orange-500/10 text-orange-300' },
            }
            const c = colorMap[zone.accent]
            return (
              <Link
                key={zone.href}
                href={zone.href}
                className={`group relative overflow-hidden rounded-2xl border border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] px-4 py-3.5 transition hover:-translate-y-0.5 hover:shadow-lg ${c.border}`}
              >
                <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100" style={{ background: `radial-gradient(circle at top left, ${c.glow}, transparent 50%)` }} />
                <div className="relative flex items-start gap-3">
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${c.bg}`}>
                    {zone.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold tracking-tight text-white leading-tight">{zone.title}</h3>
                      <span className="text-xs text-slate-600 transition group-hover:text-slate-400 flex-shrink-0">→</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{zone.description}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
