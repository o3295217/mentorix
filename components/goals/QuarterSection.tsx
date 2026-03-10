'use client'

import { useState, useRef, useEffect } from 'react'
import { monthNames } from '@/lib/goals-utils'

interface QuarterSectionProps {
  quarter: number
  year: number
  goals: string[]
  isExpanded: boolean
  isCurrent: boolean
  progress: { total: number; completed: number; percent: number }
  onToggle: () => void
  onAddGoal: (text: string) => void
  onRemoveGoal: (index: number) => void
  onEditGoal: (index: number, text: string) => void
  onCopyGoal?: (goal: string, targetType: 'month' | 'week', targetKey: string) => void
  periodGoals: Map<string, string[]>
  children?: React.ReactNode
}

export default function QuarterSection({
  quarter,
  year,
  goals,
  isExpanded,
  isCurrent,
  progress,
  onToggle,
  onAddGoal,
  onRemoveGoal,
  onEditGoal,
  onCopyGoal,
  periodGoals,
  children
}: QuarterSectionProps) {
  const [newGoal, setNewGoal] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const [copyDropdownIndex, setCopyDropdownIndex] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setCopyDropdownIndex(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAdd = () => {
    if (newGoal.trim()) {
      onAddGoal(newGoal)
      setNewGoal('')
    }
  }

  const handleSaveEdit = (index: number) => {
    if (editingText.trim()) {
      onEditGoal(index, editingText)
    }
    setEditingIndex(null)
    setEditingText('')
  }

  const scrollToElement = (elementId: string) => {
    const element = document.getElementById(elementId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      element.classList.add('ring-2', 'ring-blue-500/50')
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-blue-500/50')
      }, 2000)
    }
  }

  return (
    <div
      id={`quarter-${year}-Q${quarter}`}
      className={`pl-4 border-l-2 transition-colors ${
        isCurrent ? 'border-blue-500' : 'border-gray-800'
      } ${isCurrent ? 'bg-blue-500/5 rounded-r-lg' : ''}`}
    >
      {/* Заголовок квартала */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-2 hover:bg-gray-900/30 rounded transition-colors"
      >
        <span className="text-gray-500 text-xs w-3 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▸
        </span>
        <span className="font-semibold text-sm">Q{quarter}</span>
        {isCurrent && (
          <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">сейчас</span>
        )}
        <span className="text-xs text-gray-500">
          {goals.length} {goals.length === 1 ? 'цель' : goals.length < 5 ? 'цели' : 'целей'}
        </span>
        {goals.length > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-blue-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500">{progress.completed}/{progress.total}</span>
          </div>
        )}
      </button>

      {/* Содержимое */}
      {isExpanded && (
        <div className="pb-3 space-y-2 mt-1">
          {/* Добавление */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder={`Цель на Q${quarter}...`}
              className="input text-sm py-1.5"
            />
            <button onClick={handleAdd} className="btn-primary text-sm px-3 py-1.5">+</button>
          </div>

          {/* Список целей */}
          <div className="space-y-1">
            {goals.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-2">Нет целей на Q{quarter}</p>
            ) : (
              goals.map((goal, index) => {
                const copiedTo: { type: 'month' | 'week'; label: string; key: string }[] = []
                const goalLower = goal.trim().toLowerCase()
                
                ;[0, 1, 2].forEach(offset => {
                  const m = (quarter - 1) * 3 + offset
                  const mKey = `${year}-${String(m + 1).padStart(2, '0')}`
                  const mGoals = periodGoals.get(mKey) || []
                  if (mGoals.some(g => g.trim().toLowerCase() === goalLower)) {
                    copiedTo.push({ type: 'month', label: monthNames[m].slice(0, 3), key: mKey })
                  }
                })
                
                const currMonth = new Date().getMonth()
                const currQuarter = Math.floor(currMonth / 3) + 1
                const currentYear = new Date().getFullYear()
                
                if (quarter === currQuarter && year === currentYear) {
                  const firstD = new Date(year, currMonth, 1)
                  const lastD = new Date(year, currMonth + 1, 0)
                  const curr = new Date(firstD)
                  while (curr.getDay() !== 1) curr.setDate(curr.getDate() + 1)
                  let wNum = 1
                  while (curr <= lastD) {
                    const wKey = `${year}-${String(currMonth + 1).padStart(2, '0')}-W${wNum}`
                    const wGoals = periodGoals.get(wKey) || []
                    if (wGoals.some(g => g.trim().toLowerCase() === goalLower)) {
                      copiedTo.push({ type: 'week', label: `W${wNum}`, key: wKey })
                    }
                    curr.setDate(curr.getDate() + 7)
                    wNum++
                  }
                }
                
                return (
                  <div
                    key={index}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-900/50 transition-colors group/item"
                  >
                    <span className="w-4 h-4 rounded bg-gray-800 text-gray-500 flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                      {index + 1}
                    </span>
                    {editingIndex === index ? (
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={() => handleSaveEdit(index)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(index)
                          if (e.key === 'Escape') { setEditingIndex(null); setEditingText('') }
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-gray-700 rounded-lg bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                        autoFocus
                      />
                    ) : (
                      <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
                        {copiedTo.length > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const first = copiedTo[0]
                              scrollToElement(first.type === 'month' ? `month-${first.key}` : `week-${first.key}`)
                            }}
                            className="text-sm text-left text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                          >
                            {goal}
                          </button>
                        ) : (
                          <span className="text-sm text-gray-200">{goal}</span>
                        )}
                        {copiedTo.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {copiedTo.map((c, i) => (
                              <button
                                key={i}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  scrollToElement(c.type === 'month' ? `month-${c.key}` : `week-${c.key}`)
                                }}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200 transition-colors cursor-pointer"
                              >
                                {c.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      {onCopyGoal && (
                        <div className="relative" ref={copyDropdownIndex === index ? dropdownRef : null}>
                          <button
                            onClick={() => setCopyDropdownIndex(copyDropdownIndex === index ? null : index)}
                            className="text-gray-500 hover:text-blue-400 p-1 rounded hover:bg-gray-800 transition-colors text-xs"
                            title="Копировать в период"
                          >
                            ↓
                          </button>
                          {copyDropdownIndex === index && (
                            <div className="absolute right-0 top-7 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-10 py-1 min-w-[140px] max-h-[300px] overflow-y-auto">
                              <div className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-800">Месяцы Q{quarter}</div>
                              {[0, 1, 2].map(offset => {
                                const m = (quarter - 1) * 3 + offset
                                return (
                                  <button
                                    key={m}
                                    onClick={() => {
                                      onCopyGoal(goal, 'month', `${year}-${String(m + 1).padStart(2, '0')}`)
                                      setCopyDropdownIndex(null)
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                                  >
                                    {monthNames[m]}
                                  </button>
                                )
                              })}
                              {isCurrent && (() => {
                                const currMonth = new Date().getMonth()
                                const weeksData: { num: number; start: Date; end: Date }[] = []
                                const firstD = new Date(year, currMonth, 1)
                                const lastD = new Date(year, currMonth + 1, 0)
                                const curr = new Date(firstD)
                                while (curr.getDay() !== 1) curr.setDate(curr.getDate() + 1)
                                let wNum = 1
                                while (curr <= lastD) {
                                  const wStart = new Date(curr)
                                  const wEnd = new Date(curr)
                                  wEnd.setDate(wEnd.getDate() + 6)
                                  weeksData.push({ num: wNum, start: wStart, end: wEnd })
                                  curr.setDate(curr.getDate() + 7)
                                  wNum++
                                }
                                return (
                                  <>
                                    <div className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider border-b border-t border-gray-800 mt-1">
                                      Недели {monthNames[currMonth]}
                                    </div>
                                    {weeksData.map(w => (
                                      <button
                                        key={w.num}
                                        onClick={() => {
                                          onCopyGoal(goal, 'week', `${year}-${String(currMonth + 1).padStart(2, '0')}-W${w.num}`)
                                          setCopyDropdownIndex(null)
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                                      >
                                        W{w.num} ({w.start.getDate()}-{w.end.getDate()})
                                      </button>
                                    ))}
                                  </>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => { setEditingIndex(index); setEditingText(goal) }}
                        className="text-gray-500 hover:text-gray-300 p-1 rounded hover:bg-gray-800 transition-colors text-xs"
                      >
                        &#9998;
                      </button>
                      <button
                        onClick={() => onRemoveGoal(index)}
                        className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-gray-800 transition-colors text-xs"
                      >
                        &#10005;
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Детализация (Children — месяцы) */}
          {children}
        </div>
      )}
    </div>
  )
}
