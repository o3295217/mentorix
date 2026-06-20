import Link from 'next/link'

export default function CtaSection() {
  return (
    <section className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[200px]" />
      </div>

      <div className="relative max-w-3xl mx-auto text-center" data-reveal>
        <p className="landing-reveal text-lg sm:text-xl text-slate-400 font-medium mb-4">
          Помощник помогает связывать цель с каждым днём.
        </p>
        <h2 className="landing-reveal text-4xl sm:text-6xl font-bold text-white leading-tight tracking-tight">
          Путь к&nbsp;мечте начинается
          <br />
          <span className="landing-gradient-text">прямо сейчас</span>
        </h2>
        <p className="landing-reveal landing-reveal-delay-1 mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Попробуйте магию Ассистента: расскажите о себе и своей цели. Вы даже не подозреваете, что ждёт вас впереди.
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
  )
}
