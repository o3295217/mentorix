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
  const [activeDayStep, setActiveDayStep] = useState(0)
  const [hoveredDayStep, setHoveredDayStep] = useState<number | null>(null)

  useEffect(() => {
    if (hoveredDayStep !== null) return

    const intervalId = window.setInterval(() => {
      setActiveDayStep((prev) => (prev + 1) % DAY_FLOW_STEPS.length)
    }, 1600)

    return () => window.clearInterval(intervalId)
  }, [hoveredDayStep])

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
              <span className="relative">Начать бесплатно</span>
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
                <div className="absolute -inset-4 bg-blue-500/10 rounded-3xl blur-2xl" />
                <div className="relative bg-gray-900/80 border border-gray-800 rounded-2xl px-6 py-3 sm:px-8 sm:py-4 backdrop-blur-sm">

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

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Mock AI evaluation card */}
            <div data-reveal className="landing-reveal order-2 lg:order-1">
              <div className="relative">
                <div className="absolute -inset-4 bg-blue-500/5 rounded-3xl blur-2xl" />
                <div className="relative bg-gray-900/80 border border-gray-800 rounded-2xl p-8 backdrop-blur-sm space-y-6">
                  {/* Score */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">7.8</span>
                    </div>
                    <div>
                      <div className="text-white font-semibold">Оценка дня</div>
                      <div className="text-gray-500 text-sm">Хороший продуктивный день</div>
                    </div>
                  </div>

                  {/* Criteria bars */}
                  <div className="space-y-3">
                    {[
                      { name: 'Движение к мечте', value: 8 },
                      { name: 'Стратег. фокус', value: 7 },
                      { name: 'Продуктивность', value: 9 },
                      { name: 'Баланс жизни', value: 7.5 },
                      { name: 'Дисциплина', value: 7 },
                    ].map((c) => (
                      <div key={c.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">{c.name}</span>
                          <span className="text-gray-500">{c.value}/10</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-1000"
                            style={{ width: `${c.value * 10}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Balance flags */}
                  <div className="flex gap-3">
                    {[
                      { label: 'Здоровье', ok: true },
                      { label: 'Семья', ok: true },
                      { label: 'Энергия', ok: false },
                    ].map((f) => (
                      <span
                        key={f.label}
                        className={`text-xs px-3 py-1 rounded-full ${
                          f.ok
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {f.ok ? '✓' : '—'} {f.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div data-reveal className="landing-reveal order-1 lg:order-2">
              <span className="text-blue-400 font-semibold text-sm tracking-widest uppercase mb-3 block">
                Шаг третий
              </span>
              <h2 className="text-3xl sm:text-5xl font-bold text-white leading-tight">
                ИОН, который
                <br />
                <span className="landing-gradient-text">видит картину целиком</span>
              </h2>
              <p className="mt-6 text-lg text-gray-400 leading-relaxed">
                Не просто «молодец» или «плохо». ИОН оценивает день по&nbsp;пяти критериям,
                следит за&nbsp;балансом жизни и&nbsp;даёт конкретные рекомендации.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Балл от 1 до 10 с развёрнутым объяснением',
                  'Анализ: движение к мечте, стратег. фокус, продуктивность, баланс жизни, дисциплина',
                  'Флаги баланса: здоровье, семья, энергия',
                  'Персональные рекомендации на завтра',
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
          <div className="text-center mb-12" data-reveal>
            <h2 className="landing-reveal text-3xl sm:text-5xl font-bold text-white">
              Что внутри
            </h2>
            <p className="landing-reveal landing-reveal-delay-1 mt-4 text-lg text-gray-400">
              Всё, чтобы двигаться к цели осознанно
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-reveal>
            {[
              {
                title: 'Спидометр прогресса',
                desc: 'Видишь скорость движения к мечте в реальном времени. Если замедляешься — сразу понятно.',
                accent: 'blue',
              },
              {
                title: 'Прогноз достижения',
                desc: 'ИОН считает, когда ты доберёшься до цели при текущем темпе. Ускоряешься — дата приближается.',
                accent: 'purple',
              },
              {
                title: 'Умные привычки',
                desc: 'Система замечает повторяющиеся задачи и предлагает оформить их как привычки — автоматически.',
                accent: 'green',
              },
              {
                title: 'Периодические ретро',
                desc: 'Развёрнутый анализ недели, месяца, квартала, года. Видишь тренды, а не только отдельные дни.',
                accent: 'orange',
              },
              {
                title: 'Дорожная карта',
                desc: 'Вехи пути: 10, 30, 100, 365 дней. Уровни от Новичка до Легенды. Каждый шаг — прогресс.',
                accent: 'pink',
              },
              {
                title: 'Аналитика и графики',
                desc: 'Динамика оценок, средние показатели, лучшие и худшие дни. Данные, а не ощущения.',
                accent: 'cyan',
              },
            ].map((feature, i) => {
              const colors: Record<string, string> = {
                blue: 'hover:border-blue-500/40 hover:shadow-blue-500/5',
                purple: 'hover:border-purple-500/40 hover:shadow-purple-500/5',
                green: 'hover:border-green-500/40 hover:shadow-green-500/5',
                orange: 'hover:border-orange-500/40 hover:shadow-orange-500/5',
                pink: 'hover:border-pink-500/40 hover:shadow-pink-500/5',
                cyan: 'hover:border-cyan-500/40 hover:shadow-cyan-500/5',
              }
              const dotColors: Record<string, string> = {
                blue: 'bg-blue-400',
                purple: 'bg-purple-400',
                green: 'bg-green-400',
                orange: 'bg-orange-400',
                pink: 'bg-pink-400',
                cyan: 'bg-cyan-400',
              }
              return (
                <div
                  key={feature.title}
                  className={`landing-reveal landing-reveal-delay-${Math.min(i, 3)} group p-6 rounded-2xl bg-gray-900/60 border border-gray-800 transition-all duration-300 hover:shadow-xl ${colors[feature.accent]}`}
                >
                  <div className={`w-2 h-2 rounded-full ${dotColors[feature.accent]} mb-4`} />
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ====== SECTION: КАК ВЫГЛЯДИТ ПУТЬ ====== */}
      <section className="relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/20 to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center" data-reveal>
          <h2 className="landing-reveal text-3xl sm:text-5xl font-bold text-white leading-tight">
            Не просто трекер задач.
            <br />
            <span className="text-gray-500">Это навигатор к цели.</span>
          </h2>
          <p className="landing-reveal landing-reveal-delay-1 mt-4 text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto">
            ION соединяет стратегию и&nbsp;тактику. Твоя мечта декомпозируется до&nbsp;конкретных
            задач на&nbsp;сегодня, а&nbsp;ИОН каждый вечер проверяет: ты&nbsp;ближе к&nbsp;цели
            или топчешься на&nbsp;месте.
          </p>

          {/* Visual journey line */}
          <div className="landing-reveal landing-reveal-delay-2 mt-10 max-w-2xl mx-auto relative">
            {/* Connecting line behind dots */}
            <div className="absolute top-1.5 left-4 right-4 h-px bg-gradient-to-r from-blue-400 via-gray-700 to-green-400" />
            <div className="relative flex items-start justify-between">
              {['Мечта', 'Цели', 'План дня', 'Действие', 'Оценка', 'Рост'].map((label, i) => (
                <div key={label} className="flex flex-col items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    i === 0 ? 'bg-blue-400 ring-4 ring-blue-400/20' :
                    i === 5 ? 'bg-green-400 ring-4 ring-green-400/20' :
                    'bg-gray-600'
                  }`} />
                  <span className="text-xs text-gray-500">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ====== FINAL CTA ====== */}
      <section className="relative py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[200px]" />
        </div>

        <div className="relative max-w-3xl mx-auto text-center" data-reveal>
          <h2 className="landing-reveal text-3xl sm:text-5xl font-bold text-white leading-tight">
            Путь к&nbsp;мечте начинается
            <br />
            <span className="landing-gradient-text">с&nbsp;одного дня</span>
          </h2>
          <p className="landing-reveal landing-reveal-delay-1 mt-6 text-xl text-gray-400 max-w-xl mx-auto">
            Бесплатно. Без ограничений. Просто опиши свою цель и&nbsp;начни.
          </p>
          <div className="landing-reveal landing-reveal-delay-2 mt-10">
            <Link
              href="/register"
              className="group relative inline-block px-10 py-4 text-xl font-semibold text-white rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500 group-hover:from-blue-500 group-hover:to-blue-400 transition-all" />
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.15),transparent_70%)]" />
              <span className="relative">Создать аккаунт</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="border-t border-gray-800/50 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center text-gray-600 text-sm">
          © {new Date().getFullYear()} ION. Персональный ИИ-ассистент для достижения целей.
        </div>
      </footer>
    </div>
  )
}
