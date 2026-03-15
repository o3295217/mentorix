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
        className="hidden md:block fixed right-0 top-1/2 -translate-y-1/2 z-30 
          bg-gradient-to-b from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400
          text-white shadow-[0_0_20px_rgba(59,130,246,0.25)] hover:shadow-[0_0_30px_rgba(59,130,246,0.40)] transition-all
          rounded-l-2xl px-2.5 py-8 group border border-blue-500/30 border-r-0"
        title="ИОН ассистент"
      >
        <span
          className="text-xs font-semibold tracking-widest whitespace-nowrap group-hover:tracking-[0.2em] transition-all"
          style={{ writingMode: 'vertical-rl' }}
        >
          ИОН
        </span>
      </button>
      {/* Mobile: floating bottom button */}
      <button
        onClick={onClick}
        className="md:hidden fixed right-4 bottom-4 z-30
          bg-gradient-to-br from-blue-600 to-blue-500 active:from-blue-500 active:to-blue-400
          text-white shadow-[0_0_20px_rgba(59,130,246,0.30)]
          rounded-full w-14 h-14 flex items-center justify-center border border-blue-500/30"
        title="ИОН ассистент"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </button>
    </>
  )
}
