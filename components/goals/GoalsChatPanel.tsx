'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import type { ParsedGoal } from '@/hooks/useGoalsChat'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface GoalBlock {
  periodType: 'year' | 'half_year' | 'quarter' | 'month' | 'week'
  periodKey: string
  label: string
  goals: ParsedGoal[]
}

const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

// Regex matching any period marker line
const PERIOD_MARKER_RE = /^\[(YEAR|HALF_YEAR|QUARTER|MONTH|WEEK):[^\]]+\]\s*$/

interface ContentSection {
  type: 'text' | 'goals'
  text: string // raw text for 'text' sections
  block?: GoalBlock // for 'goals' sections
}

/** Split assistant message into alternating text and goals sections */
function splitMessageIntoSections(content: string, blocks: GoalBlock[]): ContentSection[] {
  if (blocks.length === 0) {
    return [{ type: 'text', text: content }]
  }

  const cleaned = content
    .replace(/\[PROFILE:[^\]]*\]/g, '')
    .replace(/\[PROFILE_DECLINED\]/g, '')
    .replace(/\[HORIZON:\d+\]/g, '')
    .trim()

  const lines = cleaned.split('\n')
  const sections: ContentSection[] = []
  let textBuffer: string[] = []
  let blockIndex = 0

  for (const line of lines) {
    if (PERIOD_MARKER_RE.test(line.trim()) && blockIndex < blocks.length) {
      // Flush text buffer
      if (textBuffer.length > 0) {
        const text = textBuffer.join('\n').trim()
        if (text) sections.push({ type: 'text', text })
        textBuffer = []
      }
      // Skip (marker line itself is not needed, label is in the block)
      continue
    }

    // Check if this line is a goal line belonging to current block
    const isGoalLine = /^\s*(\d+[.)]\s|[-•]\s)/.test(line) && blockIndex < blocks.length
    if (isGoalLine) {
      // Accumulate goal lines — they'll be represented by the block
      // Check if we've accumulated all goals for this block
      const block = blocks[blockIndex]
      const goalText = line.replace(/^\s*(\d+[.)]\s*|[-•]\s*)/, '').trim()
      const isLastGoal = block.goals.some(
        (g, gi) => gi === block.goals.length - 1 && g.text === goalText
      )
      if (isLastGoal) {
        sections.push({ type: 'goals', text: '', block })
        blockIndex++
      }
    } else {
      textBuffer.push(line)
    }
  }

  // Flush remaining text
  if (textBuffer.length > 0) {
    const text = textBuffer.join('\n').trim()
    if (text) sections.push({ type: 'text', text })
  }

  // If some blocks weren't matched (fallback), append them
  while (blockIndex < blocks.length) {
    sections.push({ type: 'goals', text: '', block: blocks[blockIndex] })
    blockIndex++
  }

  return sections
}

function groupGoalsByBlock(goals: ParsedGoal[]): GoalBlock[] {
  const blocks: GoalBlock[] = []
  let current: GoalBlock | null = null
  for (const goal of goals) {
    if (!current || current.periodKey !== goal.periodKey || current.periodType !== goal.periodType) {
      const label = formatBlockLabel(goal.periodType, goal.periodKey)
      current = { periodType: goal.periodType, periodKey: goal.periodKey, label, goals: [] }
      blocks.push(current)
    }
    current.goals.push(goal)
  }
  return blocks
}

function formatBlockLabel(periodType: string, periodKey: string): string {
  if (periodType === 'year') return `${periodKey} год`
  if (periodType === 'half_year') {
    const m = periodKey.match(/^(\d{4})-H([12])$/)
    return m ? `H${m[2]} ${m[1]}` : periodKey
  }
  if (periodType === 'quarter') {
    const m = periodKey.match(/^(\d{4})-Q([1-4])$/)
    return m ? `Q${m[2]} ${m[1]}` : periodKey
  }
  if (periodType === 'month') {
    const m = periodKey.match(/^(\d{4})-(\d{2})$/)
    if (m) {
      const idx = parseInt(m[2], 10) - 1
      return `${MONTH_NAMES[idx] || m[2]} ${m[1]}`
    }
    return periodKey
  }
  if (periodType === 'week') {
    const m = periodKey.match(/^(\d{4})-(\d{2})-W(\d+)$/)
    if (m) {
      const idx = parseInt(m[2], 10) - 1
      return `Неделя ${m[3]}, ${MONTH_NAMES[idx] || m[2]} ${m[1]}`
    }
    return periodKey
  }
  return periodKey
}

interface GoalsChatPanelProps {
  isOpen: boolean
  onClose: () => void
  messages: ChatMessage[]
  onSendMessage: (message: string) => void
  isLoading: boolean
  contextLabel: string
  extractGoals?: (text: string) => ParsedGoal[]
  onAcceptGoals?: (goals: ParsedGoal[]) => void
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
  // Track accepted blocks: key = "msgIndex-periodType-periodKey"
  const [acceptedBlocks, setAcceptedBlocks] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Collect all unaccepted goals across all messages for "Accept all" button
  const allPendingGoals = useMemo(() => {
    if (!extractGoals || !onAcceptGoals || isLoading) return []
    const pending: { goals: ParsedGoal[]; blockKey: string }[] = []
    messages.forEach((msg, i) => {
      if (msg.role !== 'assistant') return
      const goals = extractGoals(msg.content)
      const blocks = groupGoalsByBlock(goals)
      for (const block of blocks) {
        const blockKey = `${i}-${block.periodType}-${block.periodKey}`
        if (!acceptedBlocks.has(blockKey)) {
          pending.push({ goals: block.goals, blockKey })
        }
      }
    })
    return pending
  }, [messages, extractGoals, onAcceptGoals, isLoading, acceptedBlocks])

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
                  'Проверь мой план — что поменять?',
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
            const blocks = groupGoalsByBlock(goals)

            if (msg.role === 'user') {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed text-blue-400">
                    <div className="space-y-2">{msg.content.trim().split(/\n{2,}/).map((p, j) => <p key={j} className="whitespace-pre-wrap">{p}</p>)}</div>
                  </div>
                </div>
              )
            }

            // Assistant message — split into sections with inline accept buttons
            const sections = splitMessageIntoSections(msg.content, blocks)

            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed text-slate-200">
                  <div className="space-y-3">
                    {sections.map((section, si) => {
                      if (section.type === 'text') {
                        return (
                          <div key={si} className="space-y-2">
                            {section.text.split(/\n{2,}/).map((p, j) => (
                              <p key={j} className="whitespace-pre-wrap">{p}</p>
                            ))}
                          </div>
                        )
                      }

                      // Goals block with inline accept button
                      const block = section.block!
                      const blockKey = `${i}-${block.periodType}-${block.periodKey}`
                      const isAccepted = acceptedBlocks.has(blockKey)

                      return (
                        <div key={si} className="border border-slate-700/40 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{block.label}</span>
                            {onAcceptGoals && (
                              isAccepted ? (
                                <span className="flex items-center gap-1 text-[11px] text-slate-500 bg-slate-800/40 border border-slate-700/40 rounded-full px-2.5 py-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                  Принято
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    onAcceptGoals(block.goals)
                                    setAcceptedBlocks(prev => new Set(prev).add(blockKey))
                                  }}
                                  className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-full px-2.5 py-1 transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                  Принять ({block.goals.length})
                                </button>
                              )
                            )}
                          </div>
                          <div className="space-y-1">
                            {block.goals.map((goal, gi) => (
                              <p key={gi} className="whitespace-pre-wrap text-slate-300">{gi + 1}. {goal.text}</p>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
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

        {/* "Accept all" button */}
        {allPendingGoals.length > 1 && onAcceptGoals && (
          <div className="px-4 py-2 border-t border-slate-800/60">
            <button
              onClick={() => {
                const allGoals = allPendingGoals.flatMap(p => p.goals)
                onAcceptGoals(allGoals)
                setAcceptedBlocks(prev => {
                  const next = new Set(prev)
                  for (const p of allPendingGoals) next.add(p.blockKey)
                  return next
                })
              }}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl px-3.5 py-2 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Принять всё ({allPendingGoals.reduce((s, p) => s + p.goals.length, 0)} целей, {allPendingGoals.length} блоков)
            </button>
          </div>
        )}

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
