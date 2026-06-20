'use client'

import { useEffect, useRef, useState } from 'react'
import { EVALUATION_CRITERIA, BALANCE_FLAGS } from './data'

export default function EvaluationSection() {
  const evaluationSectionRef = useRef<HTMLDivElement>(null)
  const [evaluationStage, setEvaluationStage] = useState(0)
  const [evaluationActivated, setEvaluationActivated] = useState(false)

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

  return (
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
              Ментор показывает,
              <br />
              <span className="landing-gradient-text">ведёт ли день к цели</span>
            </h2>
            <p className="mt-6 text-lg text-gray-400 leading-relaxed">
              Наставник не просто ставит оценку за день. Он помогает понять,
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
  )
}
