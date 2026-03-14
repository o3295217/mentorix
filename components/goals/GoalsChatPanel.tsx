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
          className="fixed inset-0 bg-black/40 z-35 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel — desktop: slide-in from right; mobile: bottom sheet */}
      <div
        className={`
          fixed z-40 bg-gray-900 shadow-2xl
          transition-transform duration-300 ease-in-out flex flex-col
          md:inset-y-0 md:right-0 md:w-full md:max-w-md md:border-l md:border-gray-800
          max-md:inset-x-0 max-md:bottom-0 max-md:rounded-t-2xl max-md:border-t max-md:border-gray-700 max-md:max-h-[85vh]
          ${isOpen
            ? 'md:translate-x-0 max-md:translate-y-0'
            : 'md:translate-x-full max-md:translate-y-full'}
        `}
      >
        {/* Drag handle (mobile) */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h3 className="font-semibold text-gray-200 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              ИИ Помощник
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Контекст: {contextLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-scrollbar">
          {messages.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <div className="text-3xl mb-3">🤖</div>
              <p className="text-sm">Помогу разложить мечту на конкретные шаги.</p>
              <p className="text-xs mt-2 text-gray-600">Спроси что-нибудь или попроси декомпозировать цели.</p>
              <div className="mt-6 space-y-2">
                {[
                  'Разложи мечту на годовые цели',
                  'Что мне делать в этом месяце?',
                  'Помоги спланировать ближайшую неделю',
                ].map((hint) => (
                  <button
                    key={hint}
                    onClick={() => onSendMessage(hint)}
                    className="block w-full text-left text-xs text-gray-400 hover:text-gray-200 bg-gray-800/40 hover:bg-gray-800 rounded-lg px-3 py-2 transition-colors"
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
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-200 border border-gray-700'
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
                      className="flex items-center gap-1.5 text-xs font-medium text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg px-3 py-1.5 transition-colors"
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
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      План принят ✓
                    </span>
                  </div>
                )}
              </div>
            )
          })}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-800">
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
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="btn-primary px-4 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
