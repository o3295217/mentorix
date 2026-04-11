import { PAIN_CARDS } from './data'

export default function PainSection() {
  return (
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
  )
}
