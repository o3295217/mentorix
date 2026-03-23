'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

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
            Превращаем мечту
            <br />
            <span className="landing-gradient-text">в ежедневное действие</span>
          </h1>

          {/* Sub */}
          <p className="landing-fade-in landing-delay-2 mt-8 max-w-2xl mx-auto text-lg sm:text-xl text-gray-400 leading-relaxed">
            Опиши мечту&nbsp;— ИОН поможет выбрать срок, разложить путь
            по&nbsp;периодам и&nbsp;спланировать каждый день. Он&nbsp;проверяет план,
            предлагает правки и&nbsp;учится на&nbsp;твоём опыте&nbsp;—
            с&nbsp;каждым днём точнее.
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
                Начни с&nbsp;мечты
              </h2>
              <p className="mt-6 text-lg text-gray-400 leading-relaxed">
                У каждого она своя. Кто-то хочет запустить бизнес за&nbsp;год.
                Кто-то&nbsp;— выучить язык за&nbsp;полгода. Кто-то строит карьеру на&nbsp;десятилетие вперёд.
              </p>
              <p className="mt-4 text-lg text-gray-400 leading-relaxed">
                Опиши свою цель и&nbsp;выбери свой срок&nbsp;— ION построит
                структуру из&nbsp;годовых, квартальных, месячных и&nbsp;недельных задач.
                Каждый уровень логически вытекает из&nbsp;предыдущего.
              </p>
            </div>

            {/* Visual: Goal hierarchy */}
            <div data-reveal className="landing-reveal landing-reveal-delay-1">
              <div className="relative">
                {/* Decorative glow */}
                <div className="absolute -inset-4 bg-blue-500/10 rounded-3xl blur-2xl" />
                <div className="relative bg-gray-900/80 border border-gray-800 rounded-2xl p-8 backdrop-blur-sm">
                  <div className="space-y-4">
                    {[
                      { level: 'Мечта', text: 'Твоя главная цель', color: 'from-blue-500 to-blue-400', width: '100%' },
                      { level: 'Год', text: 'Что достичь за год?', color: 'from-blue-500/80 to-blue-400/80', width: '85%' },
                      { level: 'Квартал', text: 'Конкретные результаты', color: 'from-blue-500/60 to-blue-400/60', width: '70%' },
                      { level: 'Месяц', text: 'Ближайшие шаги', color: 'from-blue-500/40 to-blue-400/40', width: '55%' },
                      { level: 'Неделя', text: 'Фокус прямо сейчас', color: 'from-blue-500/25 to-blue-400/25', width: '40%' },
                    ].map((item, i) => (
                      <div key={item.level} className="flex items-center gap-4">
                        <div
                          className={`h-10 rounded-lg bg-gradient-to-r ${item.color} flex items-center px-4 transition-all duration-500`}
                          style={{ width: item.width }}
                        >
                          <span className="text-white text-sm font-semibold whitespace-nowrap">{item.level}</span>
                        </div>
                        <span className="text-gray-500 text-sm hidden sm:block">{item.text}</span>
                      </div>
                    ))}
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
              Каждый день&nbsp;— маленькая победа
            </h2>
            <p className="landing-reveal landing-reveal-delay-2 mt-4 max-w-2xl mx-auto text-lg text-gray-400 leading-relaxed">
              Утром ты формируешь план. Вечером фиксируешь, что получилось.
              А&nbsp;дальше&nbsp;— ИОН разбирает твой день по&nbsp;косточкам.
            </p>
          </div>

          {/* Day timeline */}
          <div className="relative max-w-3xl mx-auto" data-reveal>
            {/* Vertical line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500/50 via-blue-500/50 to-transparent hidden md:block" />

            {[
              {
                time: 'Утро',
                title: 'Создай план',
                desc: 'Запиши задачи на день. Что приблизит тебя к цели? Какие привычки поддержать?',
                accent: 'purple',
              },
              {
                time: 'День',
                title: 'Действуй',
                desc: 'Отмечай выполненное по ходу дня. Система отслеживает незакрытые задачи и напоминает о них.',
                accent: 'blue',
              },
              {
                time: 'Вечер',
                title: 'Зафиксируй результат',
                desc: 'Опиши, что реально сделал. Добавь контекст: настроение, здоровье, обстоятельства.',
                accent: 'blue',
              },
              {
                time: 'Оценка',
                title: 'Получи разбор от ИОН',
                desc: 'Балл от 1 до 10, анализ по 5 критериям, флаги баланса жизни и персональные рекомендации.',
                accent: 'blue',
              },
            ].map((item, i) => (
              <div
                key={item.time}
                className={`landing-reveal landing-reveal-delay-${i} relative flex items-start gap-6 mb-6 last:mb-0 md:pl-20`}
              >
                {/* Dot on timeline */}
                <div className={`hidden md:block absolute left-[26px] top-1 w-5 h-5 rounded-full border-2 ${
                  item.accent === 'purple' ? 'border-purple-400 bg-purple-400/20' : 'border-blue-400 bg-blue-400/20'
                }`} />

                <div className="flex-1 bg-gray-900/60 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all duration-300">
                  <span className={`text-xs font-bold tracking-widest uppercase ${
                    item.accent === 'purple' ? 'text-purple-400' : 'text-blue-400'
                  }`}>
                    {item.time}
                  </span>
                  <h3 className="text-lg font-semibold text-white mt-1">{item.title}</h3>
                  <p className="text-gray-400 mt-1 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
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
