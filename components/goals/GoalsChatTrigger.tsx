'use client'

interface GoalsChatTriggerProps {
  onClick: () => void
}

export default function GoalsChatTrigger({ onClick }: GoalsChatTriggerProps) {
  return (
    <>
      {/* Desktop: vertical side button */}
      <button
        onClick={onClick}
        className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-30
          bg-white/[0.08] hover:bg-white/[0.14] backdrop-blur-sm
          text-blue-400/80 hover:text-blue-300 transition-all
          rounded-l-2xl px-1.5 py-3 group border border-white/[0.12] border-r-0
          hover:border-blue-500/20
          flex-col items-center gap-1.5"
        title="Помощь при планировании"
        aria-label="Открыть AI-помощь при планировании"
      >
        <svg className="w-[18px] h-[18px] text-blue-400 group-hover:text-blue-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span
          className="text-[11px] font-medium tracking-wider whitespace-nowrap group-hover:tracking-[0.15em] transition-all"
          style={{ writingMode: 'vertical-rl' }}
        >
          AI помощь
        </span>
      </button>
      {/* Mobile: floating bottom button */}
      <button
        onClick={onClick}
        className="app-fixed-above-nav lg:hidden fixed right-4 z-30
          bg-white/[0.08] active:bg-white/[0.14] backdrop-blur-sm
          text-blue-400 active:text-blue-300
          rounded-full w-14 h-14 flex items-center justify-center border border-white/[0.12]
          shadow-lg shadow-black/20"
        title="Помощь при планировании"
        aria-label="Открыть AI-помощь при планировании"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </button>
    </>
  )
}
