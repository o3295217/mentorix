import { TRUST_PILLARS } from './data'

export default function TrustSection() {
  return (
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
  )
}
