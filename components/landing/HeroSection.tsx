import Link from 'next/link'
import InstallAppButton from '@/components/InstallAppButton'

export default function HeroSection() {
  return (
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
            <span className="text-5xl sm:text-6xl font-black tracking-tight landing-gradient-text">
              mentorix
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
          <span className="landing-gradient-text">Ментор не&nbsp;даст сбиться с&nbsp;пути</span>
        </h1>

        {/* Sub */}
        <p className="landing-fade-in landing-delay-2 mt-8 max-w-2xl mx-auto text-lg sm:text-xl text-gray-400 leading-relaxed">
          Опиши мечту или цель&nbsp;— Гид построит для тебя понятный маршрут,
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
          <InstallAppButton />
        </div>
      </div>

    </section>
  )
}
