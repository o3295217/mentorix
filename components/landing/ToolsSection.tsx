import { TOOL_CARDS } from './data'
import ToolVisual from './ToolVisual'

export default function ToolsSection() {
  return (
    <section className="relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-12" data-reveal>
          <h2 className="landing-reveal text-3xl sm:text-5xl font-bold text-white">
            Держите путь
            <br />
            <span className="landing-gradient-text">под контролем</span>
          </h2>
          <p className="landing-reveal landing-reveal-delay-1 mt-4 max-w-2xl mx-auto text-lg text-gray-400">
            Гид показывает темп, прогноз и сигналы отклонения, чтобы вы замечали их раньше, чем потеряете направление.
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
  )
}
