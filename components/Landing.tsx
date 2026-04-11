'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const DAY_FLOW_STEPS = [
  {
    time: 'План',
    title: 'Собери день',
    desc: 'ION помогает собрать план из шагов, которые действительно ведут к цели.',
    accent: 'purple',
  },
  {
    time: 'Фокус',
    title: 'Выдели главное',
    desc: 'План остаётся реалистичным: важное попадает в день, лишнее не создаёт перегруз.',
    accent: 'blue',
  },
  {
    time: 'Результат',
    title: 'Сверь план с реальностью',
    desc: 'В конце дня вы фиксируете, что получилось на самом деле, а что осталось за рамками.',
    accent: 'blue',
  },
  {
    time: 'Разбор',
    title: 'Получи следующий шаг',
    desc: 'ION оценивает день и подсказывает, как двигаться дальше, чтобы не терять направление.',
    accent: 'green',
  },
] as const

const EVALUATION_CRITERIA = [
  { name: 'Движение к мечте', value: 8 },
  { name: 'Стратег. фокус', value: 7 },
  { name: 'Продуктивность', value: 9 },
  { name: 'Баланс жизни', value: 7.5 },
  { name: 'Дисциплина', value: 7 },
] as const

const BALANCE_FLAGS = [
  { label: 'Здоровье', ok: true },
  { label: 'Семья', ok: true },
  { label: 'Энергия', ok: false },
] as const

const PAIN_CARDS = [
  {
    title: 'День прошёл, а к мечте как будто не приблизился',
    desc: 'Вроде весь день что-то делал, решал, закрывал. А вечером ловишь себя на мысли: сил ушло много, но к тому, что по-настоящему важно, так и не подошёл.',
    signal: 'Столько движения, а внутри пусто.',
    accent: 'rose',
  },
  {
    title: 'Цель вроде есть, но живёт где-то отдельно от жизни',
    desc: 'Когда-то она вдохновляла и казалась важной. А потом осталась в заметках, а дни снова заполнились срочным, привычным и чужими задачами.',
    signal: 'Мечта есть. Связи с сегодняшним днём нет.',
    accent: 'amber',
  },
  {
    title: 'Непонятно, движешься вперёд или просто крутишься на месте',
    desc: 'Нет ясного взгляда со стороны, нет метрик, нет ощущения опоры. Только смутное чувство, что что-то важное всё время ускользает.',
    signal: 'Чувство тревоги есть. Ясности нет.',
    accent: 'slate',
  },
] as const

const TOOL_CARDS = [
  {
    title: 'Прогноз достижения',
    desc: 'Показывает, куда ведёт текущий темп и сколько времени займёт путь к цели.',
    accent: 'purple',
    badge: 'Прогноз',
    metric: '2.4 года',
    visual: 'forecast',
  },
  {
    title: 'Спидометр прогресса',
    desc: 'Показывает, ускоряетесь вы или теряете темп, чтобы вовремя вернуть движение к цели.',
    accent: 'blue',
    badge: 'Темп',
    metric: '68%',
    visual: 'speed',
  },
  {
    title: 'Периодические ретро',
    desc: 'Разбор недели, месяца, квартала и года помогает увидеть тренды, а не жить только одним днём.',
    accent: 'orange',
    badge: 'Ретро',
    metric: '4 уровня',
    visual: 'retro',
  },
  {
    title: 'Аналитика и графики',
    desc: 'Данные помогают понять, что реально работает на цель, а где вы только чувствуете движение.',
    accent: 'cyan',
    badge: 'Данные',
    metric: '24/7',
    visual: 'analytics',
  },
] as const

const TRUST_PILLARS = [
  {
    title: 'Приватный контур',
    desc: 'Ваши цели, записи и разборы дня не публикуются. Чувствительные тексты шифруются в базе.',
    accent: 'emerald',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-1.5 0h12a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4.5 19.5V12a1.5 1.5 0 0 1 1.5-1.5Z" />
      </svg>
    ),
  },
  {
    title: 'Защищённый доступ',
    desc: 'Авторизация защищена серверной подписью сессий. Пространство остаётся персональным.',
    accent: 'blue',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M12 3l7.5 3v5.25c0 4.047-2.866 7.66-6.75 8.436C8.866 18.91 6 15.297 6 11.25V6L12 3Z" />
      </svg>
    ),
  },
  {
    title: 'Без публичного шума',
    desc: 'ИОН не лента и не витрина. Это спокойное личное пространство для целей, планов и честного разбора дня.',
    accent: 'amber',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h9m-9 4.5h6m-6 4.5h9M5.25 4.5h13.5A2.25 2.25 0 0 1 21 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 17.25V6.75A2.25 2.25 0 0 1 5.25 4.5Z" />
      </svg>
    ),
  },
  {
    title: 'Понятная роль ИОН',
    desc: 'AION — умный ассистент ИОН. Он не решает за вас, а помогает держать связь между целью, днём и обратной связью.',
    accent: 'violet',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6.75 6.75 0 0 0 6.75-6.75V6.963a48.32 48.32 0 0 0-13.5 0V12A6.75 6.75 0 0 0 12 18.75Zm0 0v2.25m-3.75 0h7.5" />
      </svg>
    ),
  },
] as const

function ToolVisual({ visual, accent }: { visual: (typeof TOOL_CARDS)[number]['visual']; accent: (typeof TOOL_CARDS)[number]['accent'] }) {
  const lineClass =
    accent === 'purple'
      ? 'from-purple-400 to-fuchsia-300'
      : accent === 'orange'
      ? 'from-orange-400 to-amber-300'
      : accent === 'cyan'
      ? 'from-cyan-400 to-sky-300'
      : 'from-blue-400 to-indigo-300'

  if (visual === 'forecast') {
    return (
      <div className="relative h-20 overflow-hidden">
        <div className="absolute inset-x-4 bottom-4 h-px bg-slate-800" />
        <div className="absolute inset-x-4 top-4 h-px bg-slate-900/60" />
        <div className="absolute left-4 top-4 bottom-4 w-px bg-slate-900/60" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 220 80" fill="none">
          <path d="M18 58 C52 56, 70 50, 100 44 S150 28, 202 18" stroke="url(#forecastGlow)" strokeWidth="10" strokeLinecap="round" opacity="0.22" />
          <path d="M18 58 C52 56, 70 50, 100 44 S150 28, 202 18" fill="url(#forecastArea)" opacity="0.28" />
          <path d="M18 58 C52 56, 70 50, 100 44 S150 28, 202 18" className="stroke-[3] drop-shadow-[0_0_8px_rgba(255,255,255,0.12)]" stroke="url(#forecastGradient)" strokeLinecap="round" />
          <circle cx="18" cy="58" r="3.5" fill="#cbd5e1" opacity="0.65" />
          <circle cx="202" cy="18" r="5" fill="white" />
          <defs>
            <linearGradient id="forecastGradient" x1="18" y1="58" x2="202" y2="18" gradientUnits="userSpaceOnUse">
              <stop stopColor={accent === 'purple' ? '#a78bfa' : '#60a5fa'} />
              <stop offset="1" stopColor={accent === 'purple' ? '#f0abfc' : '#93c5fd'} />
            </linearGradient>
            <linearGradient id="forecastGlow" x1="18" y1="58" x2="202" y2="18" gradientUnits="userSpaceOnUse">
              <stop stopColor={accent === 'purple' ? '#7c3aed' : '#2563eb'} />
              <stop offset="1" stopColor={accent === 'purple' ? '#e879f9' : '#7dd3fc'} />
            </linearGradient>
            <linearGradient id="forecastArea" x1="110" y1="18" x2="110" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={accent === 'purple' ? '#c084fc' : '#93c5fd'} stopOpacity="0.22" />
              <stop offset="1" stopColor={accent === 'purple' ? '#c084fc' : '#93c5fd'} stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute left-4 bottom-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">Сейчас</div>
        <div className="absolute right-4 top-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">Цель</div>
      </div>
    )
  }

  if (visual === 'speed') {
    return (
      <div className="relative h-20 overflow-hidden">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 260 110" fill="none">
          <path
            d="M54 82 A76 76 0 0 1 206 82"
            stroke="#243247"
            strokeWidth="7"
            strokeLinecap="round"
            opacity="0.9"
          />
          <path
            d="M54 82 A76 76 0 0 1 206 82"
            stroke="url(#speedGradient)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M130 82 L172 44"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
          <circle cx="130" cy="82" r="4.5" fill="#f8fafc" />
          <circle cx="130" cy="82" r="8" fill="rgba(255,255,255,0.08)" />
          <defs>
            <linearGradient id="speedGradient" x1="54" y1="82" x2="206" y2="82" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fb7185" />
              <stop offset="0.52" stopColor="#fcd34d" />
              <stop offset="1" stopColor="#4ade80" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    )
  }

  if (visual === 'retro') {
    return (
      <div className="grid h-20 grid-cols-4 gap-2 py-1">
        {['Нед', 'Мес', 'Кв', 'Год'].map((label, index) => (
          <div
            key={label}
            className={`flex flex-col items-center justify-center rounded-xl border text-[10px] font-semibold uppercase tracking-[0.14em] ${
              index === 0
                ? 'border-orange-400/35 bg-orange-500/10 text-orange-200'
                : index === 1
                ? 'border-orange-300/20 bg-orange-500/5 text-orange-100/80'
                : 'border-slate-800 bg-slate-900/70 text-slate-500'
            }`}
          >
            {label}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-20 items-end gap-2 px-1 pb-1">
      {[28, 46, 22, 60, 38, 72].map((height, index) => (
        <div key={height} className="flex h-full flex-1 items-end rounded-t-lg bg-slate-800 overflow-hidden">
          <div
            className={`w-full rounded-t-lg bg-gradient-to-t ${lineClass}`}
            style={{ height: `${height}%`, opacity: index >= 4 ? 1 : 0.75 }}
          />
        </div>
      ))}
    </div>
  )
}

// Хук для анимации появления при скролле
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('landing-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -80px 0px' }
    )

    // Наблюдаем за всеми дочерними элементами с data-reveal
    el.querySelectorAll('[data-reveal]').forEach((child) => {
      observer.observe(child)
    })

    return () => observer.disconnect()
  }, [])

  return ref
}

export default function Landing() {
  const revealRef = useScrollReveal()
  const evaluationSectionRef = useRef<HTMLDivElement>(null)
  const [activeDayStep, setActiveDayStep] = useState(0)
  const [hoveredDayStep, setHoveredDayStep] = useState<number | null>(null)
  const [evaluationStage, setEvaluationStage] = useState(0)
  const [evaluationActivated, setEvaluationActivated] = useState(false)

  useEffect(() => {
    if (hoveredDayStep !== null) return

    const intervalId = window.setInterval(() => {
      setActiveDayStep((prev) => (prev + 1) % DAY_FLOW_STEPS.length)
    }, 1600)

    return () => window.clearInterval(intervalId)
  }, [hoveredDayStep])

  useEffect(() => {
    const el = evaluationSectionRef.current
    if (!el || evaluationActivated) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setEvaluationActivated(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.35 }
    )

    observer.observe(el)

    return () => observer.disconnect()
  }, [evaluationActivated])

  useEffect(() => {
    if (!evaluationActivated) return

    const timeouts = [
      window.setTimeout(() => setEvaluationStage(1), 700),
      window.setTimeout(() => setEvaluationStage(2), 1450),
      window.setTimeout(() => setEvaluationStage(3), 2200),
    ]

    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
    }
  }, [evaluationActivated])

  const visibleDayStep = hoveredDayStep ?? activeDayStep

  return (
    <div
      ref={revealRef}
      className="min-h-screen bg-gray-950 -my-8 w-screen overflow-hidden"
      style={{ marginLeft: 'calc(-50vw + 50%)' }}
    >
      {/* ====== HERO ====== */}
      <section className="relative pt-20 sm:pt-28 pb-12 sm:pb-16 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        {/* Animated bg orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="landing-orb landing-orb-1" />
          <div className="landing-orb landing-orb-2" />
          <div className="landing-orb landing-orb-3" />
          {/* Grid overlay */}
          <div className="absolute inset-0 landing-grid opacity-[0.03]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Logo */}
          <div className="landing-fade-in mb-6 flex flex-col items-center">
            <div className="inline-flex flex-col items-stretch">
              <span className="text-5xl sm:text-6xl font-black tracking-tight inline-flex">
                <span className="aion-letter-a">A</span>
                <span className="aion-letter-i">I</span>
                <span className="aion-letters-on">ON</span>
              </span>
              <span className="aion-subtitle text-sm sm:text-base uppercase font-medium mt-1 landing-gradient-text-subtle">
                {'ассистент'.split('').map((c, i) => <span key={i}>{c}</span>)}
              </span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="landing-fade-in landing-delay-1 text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] tracking-tight">
            Сделай каждый день шагом к&nbsp;мечте&nbsp;—
            <br />
            <span className="landing-gradient-text">ИОН не&nbsp;даст сбиться с&nbsp;пути</span>
          </h1>

          {/* Sub */}
          <p className="landing-fade-in landing-delay-2 mt-8 max-w-2xl mx-auto text-lg sm:text-xl text-gray-400 leading-relaxed">
            Опиши мечту или цель&nbsp;— ИОН построит для тебя понятный маршрут,
            разложит его на&nbsp;шаги и&nbsp;будет ежедневно помогать двигаться вперёд.
          </p>

          {/* CTA */}
          <div className="landing-fade-in landing-delay-3 mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="group relative px-8 py-4 text-lg font-semibold text-white rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500 group-hover:from-blue-500 group-hover:to-blue-400 transition-all" />
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.15),transparent_70%)]" />
              <span className="relative">Начать</span>
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 text-lg font-semibold text-gray-300 rounded-2xl border border-gray-700 hover:border-gray-500 hover:text-white transition-all duration-300"
            >
              Войти
            </Link>
          </div>
        </div>

      </section>

      {/* ====== SECTION: БОЛИ ====== */}
      <section className="relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto" data-reveal>
          <div className="landing-reveal max-w-3xl">
            <h2 className="text-4xl sm:text-6xl font-bold text-white leading-[0.98] tracking-tight">
              Узнаёте себя?
            </h2>
            <p className="mt-5 max-w-xl text-lg text-slate-400 leading-relaxed">
              Иногда это не выглядит как проблема. Просто день проходит, а главное снова остаётся в стороне.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {PAIN_CARDS.map((pain, i) => {
              const tone =
                pain.accent === 'rose'
                  ? {
                      hover: 'hover:border-rose-500/35 hover:shadow-[0_20px_60px_rgba(244,63,94,0.10)]',
                      signal: 'text-rose-100/90',
                    }
                  : pain.accent === 'amber'
                  ? {
                      hover: 'hover:border-amber-500/35 hover:shadow-[0_20px_60px_rgba(245,158,11,0.10)]',
                      signal: 'text-amber-50/90',
                    }
                  : {
                      hover: 'hover:border-sky-400/25 hover:shadow-[0_20px_60px_rgba(148,163,184,0.10)]',
                      signal: 'text-slate-100/85',
                    }

              return (
              <div
                key={pain.title}
                className={`landing-reveal landing-reveal-delay-${i + 1} group relative overflow-hidden rounded-[28px] border border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.96))] p-6 sm:p-7 transition-all duration-300 hover:-translate-y-1 ${tone.hover}`}
              >
                <div className="relative">
                  <h3 className="text-[22px] font-semibold text-white leading-[1.2] tracking-tight">
                    {pain.title}
                  </h3>
                  <p className="mt-4 text-[15px] text-slate-300/85 leading-7">
                    {pain.desc}
                  </p>

                  <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p className={`text-sm font-medium tracking-[0.01em] ${tone.signal}`}>
                      {pain.signal}
                    </p>
                  </div>
                </div>
              </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ====== SECTION: МЕЧТА ====== */}
      <section className="relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div data-reveal className="landing-reveal">
              <span className="text-blue-400 font-semibold text-sm tracking-widest uppercase mb-3 block">
                Шаг первый
              </span>
              <h2 className="text-3xl sm:text-5xl font-bold text-white leading-tight">
                Сначала — ваш
                <br />
                <span className="landing-gradient-text">контекст и цель</span>
              </h2>
              <p className="mt-6 text-lg text-gray-400 leading-relaxed">
                Сначала вы заполняете профиль, чтобы ION понял ваш ритм жизни,
                интересы и приоритеты. Это помогает строить не абстрактный,
                а реалистичный путь к цели.
              </p>
              <p className="mt-4 text-lg text-gray-400 leading-relaxed">
                Потом вы описываете мечту или цель и&nbsp;выбираете срок&nbsp;— ION
                раскладывает путь на&nbsp;годовые, квартальные, месячные и&nbsp;недельные
                шаги, чтобы каждый день опирался на&nbsp;ваш реальный контекст.
              </p>
            </div>

            {/* Visual: ИОН засасывает анкету → молния → Мечта загорается */}
            <div data-reveal className="landing-reveal landing-reveal-delay-1">
              <div className="relative">
                <div className="absolute -inset-5 rounded-[30px] bg-blue-500/8 blur-3xl" />
                <div className="relative rounded-2xl border border-slate-800/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.42),rgba(15,23,42,0.18))] px-6 py-3 backdrop-blur-md sm:px-8 sm:py-4">

                  <div className="relative">
                    {/* Orbit: теги вокруг ION сферы, засасываются к центру */}
                    <div className="relative w-full" style={{ height: '210px' }}>
                      {/* Теги на орбите */}
                      {[
                        { label: 'Профессия', cls: 'ion-tag-0' },
                        { label: 'Ценности', cls: 'ion-tag-1' },
                        { label: 'Интересы', cls: 'ion-tag-2' },
                        { label: 'Вызовы', cls: 'ion-tag-3' },
                        { label: 'Образ жизни', cls: 'ion-tag-4' },
                        { label: 'Образование', cls: 'ion-tag-5' },
                      ].map((tag) => (
                        <span
                          key={tag.label}
                          className={`absolute top-1/2 left-1/2 ion-tag ${tag.cls} rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 whitespace-nowrap z-10`}
                        >
                          {tag.label}
                        </span>
                      ))}

                      {/* ION сфера в центре орбиты */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                        <div className="ion-sphere-glow absolute -inset-8 rounded-full bg-blue-500/20 blur-2xl" />
                        <div className="ion-sphere relative flex h-14 w-14 items-center justify-center rounded-full border border-blue-400/40 bg-[radial-gradient(circle_at_30%_30%,rgba(96,165,250,0.5),rgba(59,130,246,0.15)_50%,rgba(15,23,42,0.9)_80%)] shadow-[0_0_32px_rgba(96,165,250,0.2)]">
                          <div className="absolute inset-1.5 rounded-full border border-white/10" />
                          <span className="text-[10px] font-bold tracking-[0.2em] text-blue-100">ION</span>
                        </div>
                      </div>
                    </div>

                    {/* Молния — absolute от низа сферы до баров, не влияет на layout */}
                    <svg className="ion-lightning origin-top absolute z-10 pointer-events-none" style={{ top: '133px', left: '50%', marginLeft: '-16px' }} width="32" height="68" viewBox="0 0 32 68" fill="none">
                      <defs>
                        <filter id="lightning-glow" x="-100%" y="-20%" width="300%" height="140%">
                          <feGaussianBlur stdDeviation="3" result="blur1" />
                          <feGaussianBlur stdDeviation="7" in="SourceGraphic" result="blur2" />
                          <feMerge>
                            <feMergeNode in="blur2" />
                            <feMergeNode in="blur1" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <path d="M16 0 L19 20 L9 25 L22 45 L16 68" stroke="rgba(96,165,250,0.25)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      <path d="M16 0 L19 20 L9 25 L22 45 L16 68" stroke="rgba(147,197,253,0.45)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      <path d="M16 0 L19 20 L9 25 L22 45 L16 68" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#lightning-glow)" />
                      <path d="M9 25 L3 32" stroke="rgba(200,220,255,0.5)" strokeWidth="1" strokeLinecap="round" fill="none" />
                      <path d="M22 45 L28 50" stroke="rgba(200,220,255,0.4)" strokeWidth="0.8" strokeLinecap="round" fill="none" />
                    </svg>

                    {/* Иерархия целей */}
                    <div className="w-full mt-1 space-y-1.5">
                      {[
                        { level: 'Мечта', text: 'Запустить свой продукт', color: 'from-blue-500 to-blue-400', pct: 100, barCls: 'ion-bar-0', textCls: 'ion-goal-text-0' },
                        { level: 'Год', text: 'MVP + первые клиенты', color: 'from-blue-500/75 to-blue-400/75', pct: 85, barCls: 'ion-bar-1', textCls: 'ion-goal-text-1' },
                        { level: 'Квартал', text: 'Прототип и тесты', color: 'from-blue-500/55 to-blue-400/55', pct: 70, barCls: 'ion-bar-2', textCls: 'ion-goal-text-2' },
                        { level: 'Месяц', text: 'Исследование рынка', color: 'from-blue-500/35 to-blue-400/35', pct: 58, barCls: 'ion-bar-3', textCls: 'ion-goal-text-3' },
                        { level: 'Неделя', text: 'Описать идею и ЦА', color: 'from-blue-500/20 to-blue-400/20', pct: 48, barCls: 'ion-bar-4', textCls: 'ion-goal-text-4' },
                      ].map((item) => (
                        <div
                          key={item.level}
                          className={`h-9 rounded-lg bg-gradient-to-r ${item.color} flex items-center justify-between px-3 ${item.barCls}`}
                          style={{ width: `${item.pct}%` }}
                        >
                          <span className="text-white text-xs font-semibold whitespace-nowrap">{item.level}</span>
                          <span className={`${item.textCls} text-white/80 text-[11px] whitespace-nowrap ml-2`}>{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== SECTION: ЕЖЕДНЕВНЫЙ РИТМ ====== */}
      <section className="relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        {/* Subtle bg accent */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-[160px] pointer-events-none" />

        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12" data-reveal>
            <span className="landing-reveal text-purple-400 font-semibold text-sm tracking-widest uppercase mb-3 block">
              Шаг второй
            </span>
            <h2 className="landing-reveal landing-reveal-delay-1 text-3xl sm:text-5xl font-bold text-white leading-tight">
              Каждый день
              <br />
              <span className="landing-gradient-text">работает на цель</span>
            </h2>
            <p className="landing-reveal landing-reveal-delay-2 mt-4 max-w-2xl mx-auto text-lg text-gray-400 leading-relaxed">
              ION помогает собрать день из того, что действительно двигает вас к цели,
              выделить главное без перегруза и потом показать, насколько этот день
              сработал на результат.
            </p>
          </div>

          {/* Day timeline */}
          <div className="relative max-w-3xl mx-auto space-y-4" data-reveal>
            {DAY_FLOW_STEPS.map((item, i) => {
              const isActive = visibleDayStep === i
              const accentStyles = item.accent === 'purple'
                ? {
                    card: 'border-purple-400/45 bg-purple-500/10 shadow-[0_0_0_1px_rgba(168,85,247,0.08),0_18px_50px_rgba(76,29,149,0.18)]',
                    number: 'text-purple-300/85 [text-shadow:0_0_26px_rgba(196,181,253,0.22)]',
                    title: 'text-purple-100',
                  }
                : item.accent === 'green'
                ? {
                    card: 'border-emerald-400/45 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(52,211,153,0.08),0_18px_50px_rgba(6,95,70,0.18)]',
                    number: 'text-emerald-300/85 [text-shadow:0_0_26px_rgba(167,243,208,0.2)]',
                    title: 'text-emerald-100',
                  }
                : {
                    card: 'border-blue-400/45 bg-blue-500/10 shadow-[0_0_0_1px_rgba(96,165,250,0.08),0_18px_50px_rgba(30,64,175,0.18)]',
                    number: 'text-blue-300/85 [text-shadow:0_0_26px_rgba(147,197,253,0.22)]',
                    title: 'text-blue-100',
                  }

              return (
              <div
                key={item.time}
                className={`landing-reveal landing-reveal-delay-${i}`}
                onMouseEnter={() => setHoveredDayStep(i)}
                onMouseLeave={() => setHoveredDayStep(null)}
              >
                <div
                  className={`relative flex-1 overflow-hidden rounded-2xl border p-5 pl-20 transition-all duration-500 ${
                    isActive
                      ? accentStyles.card
                      : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute left-5 top-5 bottom-5 flex items-center text-[72px] font-extralight tracking-[-0.06em] leading-none transition-all duration-500 ${
                      isActive
                        ? accentStyles.number
                        : 'text-slate-700/35'
                    }`}
                  >
                    {i + 1}
                  </span>

                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <span
                        className={`text-[13px] font-semibold tracking-[0.18em] uppercase transition-colors duration-500 ${
                          isActive ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {item.time}
                      </span>
                      <h3 className={`mt-2 text-lg font-semibold transition-colors duration-500 ${isActive ? accentStyles.title : 'text-white'}`}>
                        {item.title}
                      </h3>
                      <p className={`mt-1 text-sm leading-relaxed transition-colors duration-500 ${isActive ? 'text-slate-200' : 'text-gray-400'}`}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ====== SECTION: ИИ-АНАЛИЗ ====== */}
      <section className="relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-[160px] pointer-events-none" />

        <div ref={evaluationSectionRef} className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Mock AI evaluation card */}
            <div data-reveal className="landing-reveal order-2 lg:order-1">
              <div className="relative">
                <div className="absolute -inset-5 rounded-[30px] bg-blue-500/6 blur-3xl" />
                <div className="relative rounded-2xl border border-slate-800/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.42),rgba(15,23,42,0.18))] p-8 backdrop-blur-md space-y-6">
                  {/* Score */}
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center transition-all duration-700 ${
                      evaluationStage === 0 ? 'shadow-[0_0_30px_rgba(59,130,246,0.35)] scale-[1.03]' : 'shadow-none scale-100'
                    }`}>
                      <span className="text-2xl font-bold text-white">7.8</span>
                    </div>
                    <div>
                      <div className="text-white font-semibold">Оценка дня</div>
                      <div className="text-gray-500 text-sm">Хороший продуктивный день</div>
                    </div>
                  </div>

                  {/* Criteria bars */}
                  <div className="space-y-3">
                    {EVALUATION_CRITERIA.map((c) => (
                      <div key={c.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className={`transition-colors duration-700 ${evaluationStage >= 1 ? 'text-gray-300' : 'text-gray-500'}`}>{c.name}</span>
                          <span className={`transition-colors duration-700 ${evaluationStage >= 1 ? 'text-gray-400' : 'text-gray-600'}`}>{c.value}/10</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-1000"
                            style={{ width: evaluationStage >= 1 ? `${c.value * 10}%` : '0%' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Balance flags */}
                  <div className="flex gap-3">
                    {BALANCE_FLAGS.map((f) => (
                      <span
                        key={f.label}
                        className={`text-xs px-3 py-1 rounded-full transition-all duration-700 ${evaluationStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-35 translate-y-1'} ${
                          f.ok
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {f.ok ? '✓' : '—'} {f.label}
                      </span>
                    ))}
                  </div>

                  <div className={`rounded-2xl border border-blue-500/15 bg-blue-500/5 px-4 py-3 transition-all duration-700 ${evaluationStage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300/80">Следующий шаг</div>
                    <div className="mt-1 text-sm text-slate-200">Сохранить фокус на главной задаче и убрать лишнее из следующего дня.</div>
                  </div>
                </div>
              </div>
            </div>

            <div data-reveal className="landing-reveal order-1 lg:order-2">
              <span className="text-blue-400 font-semibold text-sm tracking-widest uppercase mb-3 block">
                Шаг третий
              </span>
              <h2 className="text-3xl sm:text-5xl font-bold text-white leading-tight">
                ИОН показывает,
                <br />
                <span className="landing-gradient-text">ведёт ли день к цели</span>
              </h2>
              <p className="mt-6 text-lg text-gray-400 leading-relaxed">
                ИОН не просто ставит оценку за день. Он помогает понять,
                что действительно двигало вас к цели, где теряется фокус
                и какой следующий шаг даст лучший результат.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Показывает, что в дне работало на цель, а что было просто занятостью',
                  'Разбирает день по ключевым критериям: движение к цели, фокус, продуктивность, баланс и дисциплина',
                  'Подсвечивает сигналы баланса: здоровье, семья, энергия',
                  'Даёт следующий шаг, чтобы сохранить направление',
                ].map((text) => (
                  <li key={text} className="flex items-start gap-3 text-gray-300">
                    <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ====== SECTION: ФИЧИ ====== */}
      <section className="relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl mx-auto text-center mb-12" data-reveal>
            <h2 className="landing-reveal text-3xl sm:text-5xl font-bold text-white">
              Держите путь
              <br />
              <span className="landing-gradient-text">под контролем</span>
            </h2>
            <p className="landing-reveal landing-reveal-delay-1 mt-4 max-w-2xl mx-auto text-lg text-gray-400">
              ИОН показывает темп, прогноз и сигналы отклонения, чтобы вы замечали их раньше, чем потеряете направление.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-reveal>
            {TOOL_CARDS.map((feature, i) => {
              const colors: Record<string, string> = {
                blue: 'hover:border-blue-500/40 hover:shadow-[0_20px_60px_rgba(37,99,235,0.10)]',
                purple: 'hover:border-purple-500/40 hover:shadow-[0_20px_60px_rgba(147,51,234,0.10)]',
                green: 'hover:border-green-500/40 hover:shadow-[0_20px_60px_rgba(22,163,74,0.10)]',
                orange: 'hover:border-orange-500/40 hover:shadow-[0_20px_60px_rgba(234,88,12,0.10)]',
                pink: 'hover:border-pink-500/40 hover:shadow-[0_20px_60px_rgba(219,39,119,0.10)]',
                cyan: 'hover:border-cyan-500/40 hover:shadow-[0_20px_60px_rgba(6,182,212,0.10)]',
              }
              const dotColors: Record<string, string> = {
                blue: 'text-blue-300 border-blue-400/25 bg-blue-500/10',
                purple: 'text-purple-300 border-purple-400/25 bg-purple-500/10',
                green: 'text-green-300 border-green-400/25 bg-green-500/10',
                orange: 'text-orange-300 border-orange-400/25 bg-orange-500/10',
                pink: 'text-pink-300 border-pink-400/25 bg-pink-500/10',
                cyan: 'text-cyan-300 border-cyan-400/25 bg-cyan-500/10',
              }
              return (
                <div
                  key={feature.title}
                  className={`landing-reveal landing-reveal-delay-${Math.min(i, 3)} group rounded-[24px] border border-gray-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.98))] p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 ${colors[feature.accent]}`}
                >
                  <div className="flex flex-col gap-5 md:grid md:grid-cols-[180px_minmax(0,1fr)] md:items-center md:gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="min-w-0 rounded-[20px] border border-slate-800/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.015))] p-4">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${dotColors[feature.accent]}`}>
                          {feature.badge}
                        </span>
                        <span className="text-sm font-medium text-slate-500">{feature.metric}</span>
                      </div>

                      <ToolVisual visual={feature.visual} accent={feature.accent} />
                    </div>

                    <div className="min-w-0 md:self-stretch md:flex md:flex-col md:justify-center">
                      <h3 className="text-lg font-semibold text-white mb-2 tracking-tight">{feature.title}</h3>
                      <p className="text-slate-400 text-[15px] sm:text-base leading-relaxed">{feature.desc}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ====== SECTION: ДОВЕРИЕ ====== */}
      <section className="relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/6 blur-[160px]" />
        </div>

        <div className="relative max-w-6xl mx-auto">
          <div className="max-w-3xl mx-auto text-center" data-reveal>
            <h2 className="landing-reveal landing-reveal-delay-1 text-3xl sm:text-5xl font-bold text-white leading-tight tracking-tight">
              Почему ИОНу можно
              <br />
              <span className="landing-gradient-text">доверить важное</span>
            </h2>
            <p className="landing-reveal landing-reveal-delay-2 mt-4 max-w-2xl mx-auto text-lg text-slate-400 leading-relaxed">
              ИОН работает с личными целями и ежедневной рефлексией. Поэтому здесь важны не только польза, но и ощущение защищённого личного пространства.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6" data-reveal>
            {TRUST_PILLARS.map((item, i) => {
              const accentStyles =
                item.accent === 'emerald'
                  ? 'text-emerald-200 border-emerald-400/18 bg-emerald-500/8 shadow-[0_20px_50px_rgba(16,185,129,0.06)]'
                  : item.accent === 'amber'
                  ? 'text-amber-100 border-amber-300/18 bg-amber-500/8 shadow-[0_20px_50px_rgba(245,158,11,0.06)]'
                  : item.accent === 'violet'
                  ? 'text-violet-100 border-violet-400/18 bg-violet-500/8 shadow-[0_20px_50px_rgba(139,92,246,0.06)]'
                  : 'text-blue-100 border-blue-400/18 bg-blue-500/8 shadow-[0_20px_50px_rgba(59,130,246,0.06)]'

              return (
                <div
                  key={item.title}
                  className={`landing-reveal landing-reveal-delay-${Math.min(i + 1, 3)} rounded-[26px] border border-slate-800/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.52),rgba(15,23,42,0.22))] p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-slate-700/80 ${item.accent === 'emerald' ? 'hover:shadow-[0_20px_60px_rgba(16,185,129,0.08)]' : item.accent === 'amber' ? 'hover:shadow-[0_20px_60px_rgba(245,158,11,0.08)]' : item.accent === 'violet' ? 'hover:shadow-[0_20px_60px_rgba(139,92,246,0.08)]' : 'hover:shadow-[0_20px_60px_rgba(59,130,246,0.08)]'}`}
                >
                  <div className={`inline-flex rounded-[18px] border p-3 ${accentStyles}`}>
                    {item.icon}
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-white tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-base leading-7 text-slate-300/85">
                    {item.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ====== FINAL CTA ====== */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[200px]" />
        </div>

        <div className="relative max-w-3xl mx-auto text-center" data-reveal>
          <p className="landing-reveal text-lg sm:text-xl text-slate-400 font-medium mb-4">
            ИОН помогает связывать цель с каждым днём.
          </p>
          <h2 className="landing-reveal text-4xl sm:text-6xl font-bold text-white leading-tight tracking-tight">
            Путь к&nbsp;мечте начинается
            <br />
            <span className="landing-gradient-text">прямо сейчас</span>
          </h2>
          <p className="landing-reveal landing-reveal-delay-1 mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Попробуйте магию ИОН: расскажите о себе и своей цели. Вы даже не подозреваете, что ждёт вас впереди.
          </p>
          <div className="landing-reveal landing-reveal-delay-2 mt-10">
            <Link
              href="/register"
              className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full border border-blue-300/20 px-14 py-[18px] text-[22px] font-semibold text-white shadow-[0_20px_60px_rgba(37,99,235,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_80px_rgba(59,130,246,0.30)] active:translate-y-0"
            >
              <span className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#2563eb_0%,#3b82f6_45%,#6366f1_100%)] transition-all duration-300 group-hover:brightness-110" />
              <span className="absolute inset-[1px] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03)_22%,rgba(15,23,42,0.04)_100%)]" />
              <span className="absolute -left-1/3 top-0 h-full w-1/3 -skew-x-12 bg-white/20 opacity-0 blur-xl transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />
              <span className="relative">Начать путь</span>
              <svg className="relative h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-6-6m6 6-6 6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="border-t border-gray-800/40 py-10 px-4">
        <div className="max-w-7xl mx-auto text-center text-gray-700 text-sm">
          © {new Date().getFullYear()} ION AI Lab.
        </div>
      </footer>
    </div>
  )
}
