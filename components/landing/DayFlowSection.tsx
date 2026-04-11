'use client'

import { useEffect, useState } from 'react'
import { DAY_FLOW_STEPS } from './data'

export default function DayFlowSection() {
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
  )
}
