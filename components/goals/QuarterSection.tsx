'use client'

import { useState, useRef, useEffect } from 'react'
import { monthNames } from '@/lib/goals-utils'

interface QuarterSectionProps {
  quarter: number
  year: number
  goals: string[]
  isCurrent: boolean
  progress: { total: number; completed: number; percent: number }
  onAddGoal: (text: string) => void
  onRemoveGoal: (index: number) => void
  onEditGoal: (index: number, text: string) => void
  onCopyGoal?: (goal: string, targetType: 'month' | 'week', targetKey: string) => void
  periodGoals: Map<string, string[]>
}

export default function QuarterSection({
  quarter,
  year,
  goals,
  isCurrent,
  progress,
  onAddGoal,
  onRemoveGoal,
  onEditGoal,
  onCopyGoal,
  periodGoals,
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

  return (
    <div className="space-y-3">
      {/* Заголовок квартала с прогрессом */}
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-gray-300">
          Q{quarter} {year}
        </h3>
        {isCurrent && (
          <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">сейчас</span>
        )}
        {progress.total > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-blue-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 tabular-nums">{progress.completed}/{progress.total}</span>
          </div>
        )}
      </div>

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
      {goals.length > 0 && (
        <div className="space-y-1">
          {goals.map((goal, index) => {
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
                    <span className="text-sm text-gray-200">{goal}</span>
                    {copiedTo.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {copiedTo.map((c, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 border border-gray-700"
                          >
                            {c.label}
                          </span>
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
                        title="Копировать в месяц"
                      >
                        ↓
                      </button>
                      {copyDropdownIndex === index && (
                        <div className="absolute right-0 top-7 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-10 py-1 min-w-[140px]">
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
          })}
        </div>
      )}
    </div>
  )
}
