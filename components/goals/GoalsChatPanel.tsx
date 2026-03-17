'use client'

import { useState, useRef, useEffect } from 'react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface GoalsChatPanelProps {
  isOpen: boolean
  onClose: () => void
  messages: ChatMessage[]
  onSendMessage: (message: string) => void
  isLoading: boolean
  contextLabel: string
  extractGoals?: (text: string) => string[]
  onAcceptGoals?: (goals: string[]) => void
}

export default function GoalsChatPanel({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  isLoading,
  contextLabel,
  extractGoals,
  onAcceptGoals,
}: GoalsChatPanelProps) {
  const [input, setInput] = useState('')
  const [acceptedMessages, setAcceptedMessages] = useState<Set<number>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    onSendMessage(input.trim())
    setInput('')
  }

  return (
    <>
      {/* Backdrop on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-35 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel — desktop: slide-in from right; mobile: bottom sheet */}
      <div
        className={`
          fixed z-40 shadow-2xl
          transition-transform duration-300 ease-in-out flex flex-row
          md:top-16 md:bottom-0 md:right-0 md:w-full md:max-w-md md:border-l md:border-slate-800
          max-md:inset-x-0 max-md:bottom-0 max-md:rounded-t-2xl max-md:border-t max-md:border-slate-700 max-md:max-h-[85vh] max-md:flex-col
          ${isOpen
            ? 'md:translate-x-0 max-md:translate-y-0'
            : 'md:translate-x-full max-md:translate-y-full'}
        `}
        style={{ background: 'linear-gradient(180deg, rgba(15,23,42,0.99), rgba(2,6,23,1))' }}
      >
        {/* Desktop: minimal close button on left edge */}
        <button
          onClick={onClose}
          className="hidden md:flex items-center justify-center w-6 flex-shrink-0
            bg-slate-800/40 hover:bg-slate-700/60 border-r border-slate-800/60
            text-slate-600 hover:text-slate-300 transition-colors"
          title="Скрыть ИОН"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Main chat column */}
        <div className="flex-1 flex flex-col min-w-0">

        {/* Drag handle (mobile) */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-slate-700 rounded-full" />
        </div>

        {/* Context label (compact) */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Контекст: {contextLabel}</p>
          {/* Mobile close */}
          <button
            onClick={onClose}
            className="md:hidden text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-scrollbar">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-400/10 mb-4">
                <svg className="h-6 w-6 text-blue-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
              </div>
              <p className="text-sm text-slate-300 font-medium">Помогу разложить мечту на конкретные шаги.</p>
              <p className="text-xs mt-1.5 text-slate-600">Спроси что-нибудь или попроси декомпозировать цели.</p>
              <div className="mt-6 space-y-2">
                {[
                  'Разложи мечту на годовые цели',
                  'Что мне делать в этом месяце?',
                  'Помоги спланировать ближайшую неделю',
                ].map((hint) => (
                  <button
                    key={hint}
                    onClick={() => onSendMessage(hint)}
                    className="block w-full text-left text-xs text-slate-400 hover:text-slate-200 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-800/60 px-3.5 py-2.5 transition-colors"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => {
            const goals = msg.role === 'assistant' && extractGoals && !isLoading
              ? extractGoals(msg.content)
              : []
            const canAccept = goals.length > 0 && onAcceptGoals && !acceptedMessages.has(i)
            const wasAccepted = acceptedMessages.has(i)

            return (
              <div key={i}>
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white'
                        : 'bg-slate-800/80 text-slate-200 border border-slate-700/60'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
                {canAccept && (
                  <div className="flex justify-start mt-2 ml-1">
                    <button
                      onClick={() => {
                        onAcceptGoals(goals)
                        setAcceptedMessages(prev => new Set(prev).add(i))
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-full px-3.5 py-1.5 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Принять план ({goals.length})
                    </button>
                  </div>
                )}
                {wasAccepted && (
                  <div className="flex justify-start mt-2 ml-1">
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      План принят
                    </span>
                  </div>
                )}
              </div>
            )
          })}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Спроси что-нибудь..."
              className="flex-1 bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-blue-500 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>

        </div>{/* end main chat column */}
      </div>
    </>
  )
}
