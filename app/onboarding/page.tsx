'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/* ─── Slide data ─── */

interface Slide {
  id: string
  badge: string
  badgeColor: string
  title: React.ReactNode
  subtitle: string
}

const slides: Slide[] = [
  {
    id: 'welcome',
    badge: 'Добро пожаловать',
    badgeColor: 'text-blue-400',
    title: (
      <>
        Ваш путь к цели
        <br />
        <span className="onb-gradient-text">начинается здесь</span>
      </>
    ),
    subtitle:
      'ION помогает превратить большую цель в понятный план и каждый день держать фокус на главном.',
  },
  {
    id: 'pyramid',
    badge: 'Структура',
    badgeColor: 'text-purple-400',
    title: (
      <>
        Мечта становится
        <br />
        <span className="onb-gradient-text">понятным планом</span>
      </>
    ),
    subtitle:
      'С помощью ION или самостоятельно вы раскладываете мечту на понятные этапы — от года до недели. Так большая цель превращается в рабочий план.',
  },
  {
    id: 'rhythm',
    badge: 'Ежедневный ритм',
    badgeColor: 'text-blue-400',
    title: (
      <>
        ION: ежедневное планирование
        <br />
        <span className="onb-gradient-text">и оценка дня</span>
      </>
    ),
    subtitle:
      'ION помогает собрать и согласовать план с вашими целями, убрать перегруз и выделить главное. Оценка результата показывает, насколько этот день действительно приблизил вас к цели.',
  },
  {
    id: 'profile',
    badge: 'Профиль',
    badgeColor: 'text-purple-400',
    title: (
      <>
        ION точнее помогает,
        <br />
        <span className="onb-gradient-text">когда знает вас</span>
      </>
    ),
    subtitle:
      'Профиль пользователя помогает учитывать ваш ритм жизни, интересы и то, что для вас важно.',
  },
  {
    id: 'start',
    badge: 'Старт',
    badgeColor: 'text-green-400',
    title: (
      <>
        Сначала — профиль.
        <br />
        <span className="onb-gradient-text">Потом — мечта.</span>
      </>
    ),
    subtitle:
      'После кнопки Начать вы попадёте в профиль. Расскажите о себе, затем задайте мечту, и ION поможет превратить её в рабочий план по периодам.',
  },
]

/* ─── Slide-specific visuals ─── */

function PyramidVisual() {
  const levels = [
    { label: 'Мечта', w: '34%', opacity: 'opacity-100' },
    { label: 'Год', w: '44%', opacity: 'opacity-90' },
    { label: 'Полугодие', w: '54%', opacity: 'opacity-75' },
    { label: 'Квартал', w: '64%', opacity: 'opacity-60' },
    { label: 'Месяц', w: '80%', opacity: 'opacity-45' },
    { label: 'Неделя', w: '96%', opacity: 'opacity-30' },
  ]
  return (
    <div className="w-full max-w-md mx-auto space-y-2">
      {levels.map((l) => (
        <div key={l.label} className="flex justify-center">
          <div
            className={`h-10 rounded-lg bg-gradient-to-r from-blue-500 to-blue-400 ${l.opacity} flex items-center justify-center transition-all duration-500`}
            style={{ width: l.w }}
          >
            <span className="text-white text-sm font-semibold">{l.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function RhythmVisual() {
  const steps = [
    { time: 'Начало', text: 'Создайте и согласуйте план с ION', color: 'border-purple-400/40' },
    { time: 'В процессе', text: 'Выполняйте и отмечайте сделанное', color: 'border-blue-400/40' },
    { time: 'Завершение', text: 'Запросите оценку дня', color: 'border-blue-400/40' },
    { time: 'Разбор', text: 'Получите выводы и следующий шаг', color: 'border-green-400/40' },
  ]
  return (
    <div className="w-full max-w-sm mx-auto space-y-3">
      {steps.map((s) => (
        <div
          key={s.time}
          className={`flex items-center gap-4 bg-gray-900/60 border ${s.color} rounded-xl px-5 py-3`}
        >
          <span className="text-xs font-bold tracking-widest uppercase text-gray-500 w-32 flex-shrink-0 text-center leading-tight">
            {s.time}
          </span>
          <span className="text-gray-300 text-sm flex-1">{s.text}</span>
        </div>
      ))}
    </div>
  )
}

function ProfileVisual() {
  return (
    <div className="w-full max-w-sm mx-auto rounded-3xl border border-gray-800 bg-gray-900/60 p-5 space-y-3">
      {[
        'Чем вы занимаетесь',
        'Что для вас важно',
        'Ваш опыт и интересы',
        'Ваш образ жизни',
        'Ваш повседневный ритм',
      ].map((item, index) => (
        <div
          key={item}
          className={`rounded-2xl px-4 py-3 text-sm border ${
            index === 0
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
              : 'bg-slate-900/80 border-slate-700 text-slate-300'
          }`}
        >
          {item}
        </div>
      ))}
      <p className="text-xs text-slate-500 pt-1">Профиль делает рекомендации более личными.</p>
    </div>
  )
}

function StartVisual() {
  return (
    <div className="w-full max-w-xs mx-auto flex items-center justify-between">
      {['Профиль', 'Мечта', 'План'].map((label, i) => (
        <div key={label} className="flex flex-col items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              i === 0
                ? 'bg-blue-400 ring-4 ring-blue-400/20'
                : i === 2
                ? 'bg-green-400 ring-4 ring-green-400/20'
                : 'bg-slate-500 ring-4 ring-slate-500/20'
            }`}
          />
          <span className="text-xs text-gray-500">{label}</span>
        </div>
      ))}
    </div>
  )
}

const slideVisuals: Record<string, React.ReactNode> = {
  pyramid: <PyramidVisual />,
  rhythm: <RhythmVisual />,
  profile: <ProfileVisual />,
  start: <StartVisual />,
}

/* ─── Page component ─── */

export default function OnboardingPage() {
  const router = useRouter()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [completing, setCompleting] = useState(false)

  const isLastSlide = currentSlide === slides.length - 1
  const slide = slides[currentSlide]

  const handleNext = () => {
    if (isLastSlide) {
      completeOnboarding()
    } else {
      setCurrentSlide((prev) => prev + 1)
    }
  }

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1)
    }
  }

  const completeOnboarding = async () => {
    setCompleting(true)
    try {
      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        window.location.href = '/profile'
      } else {
        router.push('/profile')
      }
    } catch {
      router.push('/profile')
    }
  }

  return (
    <div
      className="min-h-screen bg-gray-950 -my-8 w-screen overflow-hidden flex flex-col"
      style={{ marginLeft: 'calc(-50vw + 50%)' }}
    >
      {/* Progress bar */}
      <div className="w-full h-0.5 bg-gray-800">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
          style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
        />
      </div>

      {/* Skip */}
      <div className="flex justify-end px-6 pt-4">
        <button
          onClick={completeOnboarding}
          disabled={completing}
          className="text-sm text-gray-600 hover:text-gray-400 transition-colors"
        >
          Пропустить
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        <div className="w-full max-w-2xl text-center">
          {/* Badge */}
          <span
            className={`text-sm font-semibold tracking-widest uppercase mb-4 block ${slide.badgeColor}`}
          >
            {slide.badge}
          </span>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight tracking-tight">
            {slide.title}
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-lg mx-auto text-lg text-gray-400 leading-relaxed">
            {slide.subtitle}
          </p>

          {/* Visual */}
          {slideVisuals[slide.id] && (
            <div className="mt-10">{slideVisuals[slide.id]}</div>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-950/80 backdrop-blur-lg border-t border-gray-800/50 py-4 px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentSlide === 0}
            className="px-5 py-2 text-gray-500 hover:text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
          >
            Назад
          </button>

          {/* Dots */}
          <div className="flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? 'bg-blue-400 w-6'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={completing}
            className="group relative px-6 py-2 text-sm font-semibold text-white rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500 group-hover:from-blue-500 group-hover:to-blue-400 transition-all" />
            <span className="relative">
              {completing ? 'Загрузка...' : isLastSlide ? 'Начать' : 'Далее'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
