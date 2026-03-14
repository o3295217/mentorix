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
          bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600
          text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all
          rounded-l-xl px-2.5 py-8 group"
        title="ИИ Помощник"
      >
        <span
          className="text-xs font-semibold tracking-widest whitespace-nowrap group-hover:tracking-[0.2em] transition-all"
          style={{ writingMode: 'vertical-rl' }}
        >
          ИИ
        </span>
      </button>
      {/* Mobile: floating bottom button */}
      <button
        onClick={onClick}
        className="md:hidden fixed right-4 bottom-4 z-30
          bg-gradient-to-br from-blue-600 to-blue-700 active:from-blue-500 active:to-blue-600
          text-white shadow-lg shadow-blue-500/25
          rounded-full w-14 h-14 flex items-center justify-center"
        title="ИИ Помощник"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </button>
    </>
  )
}
