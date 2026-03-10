'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { monthNames } from '@/lib/goals-utils'
import { getDetailLevel } from '@/lib/dates'

interface YearSectionProps {
  year: number
  currentYear: number
  goals: string[]
  onAddGoal: (text: string) => void
  onRemoveGoal: (index: number) => void
  onEditGoal: (index: number, text: string) => void
  periodGoals: Map<string, string[]>
  onCopyGoal: (goal: string, targetType: 'quarter' | 'month' | 'week', targetKey: string) => void
}

export default function YearSection({
  year,
  currentYear,
  goals,
  onAddGoal,
  onRemoveGoal,
  onEditGoal,
  periodGoals,
  onCopyGoal,
}: YearSectionProps) {
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

  const detailLevel = getDetailLevel(year, currentYear)

  const goalsWithCopiedTo = useMemo(() => {
    return goals.map(goal => {
      const copiedTo: { type: 'quarter' | 'month' | 'week'; label: string; key: string }[] = []
      const goalLower = goal.trim().toLowerCase()
      
      ;[1, 2, 3, 4].forEach(q => {
        const qKey = `${year}-Q${q}`
        const qGoals = periodGoals.get(qKey) || []
        if (qGoals.some(g => g.trim().toLowerCase() === goalLower)) {
          copiedTo.push({ type: 'quarter', label: `Q${q}`, key: qKey })
        }
      })
      
      monthNames.forEach((mName, mIdx) => {
        const mKey = `${year}-${String(mIdx + 1).padStart(2, '0')}`
        const mGoals = periodGoals.get(mKey) || []
        if (mGoals.some(g => g.trim().toLowerCase() === goalLower)) {
          copiedTo.push({ type: 'month', label: mName.slice(0, 3), key: mKey })
        }
      })
      
      if (year === currentYear) {
        for (let m = 0; m < 12; m++) {
          for (let w = 1; w <= 5; w++) {
            const wKey = `${year}-${String(m + 1).padStart(2, '0')}-W${w}`
            const wGoals = periodGoals.get(wKey) || []
            if (wGoals.some(g => g.trim().toLowerCase() === goalLower)) {
              copiedTo.push({ type: 'week', label: `W${w}`, key: wKey })
            }
          }
        }
      }
      
      return { goal, copiedTo }
    })
  }, [goals, periodGoals, year, currentYear])

  return (
    <div className="space-y-3">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-400">
          Цели на {year} год
          {goals.length > 0 && (
            <span className="ml-2 text-gray-600">({goals.length})</span>
          )}
        </h3>
      </div>

      {/* Добавление */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newGoal}
          onChange={(e) => setNewGoal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Цель на год..."
          className="input text-sm"
        />
        <button onClick={handleAdd} className="btn-primary text-sm whitespace-nowrap px-3">
          +
        </button>
      </div>

      {/* Список целей */}
      {goals.length > 0 && (
        <div className="space-y-1">
          {goalsWithCopiedTo.map(({ goal, copiedTo }, index) => (
            <div
              key={index}
              className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg hover:bg-gray-900/50 transition-colors group/item"
            >
              <span className="w-5 h-5 rounded bg-gray-800 text-gray-400 flex items-center justify-center text-xs font-medium flex-shrink-0">
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
                <div className="flex-1 flex items-center gap-2 flex-wrap min-w-0">
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

              {/* Действия — при наведении */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                {(detailLevel === 'month' || detailLevel === 'quarter') && (
                  <div className="relative" ref={copyDropdownIndex === index ? dropdownRef : null}>
                    <button
                      onClick={() => setCopyDropdownIndex(copyDropdownIndex === index ? null : index)}
                      className="text-gray-500 hover:text-blue-400 p-1 rounded hover:bg-gray-800 transition-colors text-sm"
                      title="Копировать в период"
                    >
                      ↓
                    </button>
                    {copyDropdownIndex === index && (
                      <div className="absolute right-0 top-8 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-10 py-1 min-w-[160px] max-h-[400px] overflow-y-auto">
                        <div className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-800">Кварталы</div>
                        {[1, 2, 3, 4].map(q => (
                          <button
                            key={q}
                            onClick={() => {
                              onCopyGoal(goal, 'quarter', `${year}-Q${q}`)
                              setCopyDropdownIndex(null)
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                          >
                            Q{q}
                          </button>
                        ))}
                        <div className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider border-b border-t border-gray-800 mt-1">Месяцы</div>
                        {monthNames.map((mName, mIdx) => (
                          <button
                            key={mIdx}
                            onClick={() => {
                              onCopyGoal(goal, 'month', `${year}-${String(mIdx + 1).padStart(2, '0')}`)
                              setCopyDropdownIndex(null)
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                          >
                            {mName}
                          </button>
                        ))}
                        
                        {year === currentYear && (() => {
                          const today = new Date()
                          const currMonth = today.getMonth()
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
                  onClick={() => {
                    setEditingIndex(index)
                    setEditingText(goal)
                  }}
                  className="text-gray-500 hover:text-gray-300 p-1 rounded hover:bg-gray-800 transition-colors text-sm"
                  title="Редактировать"
                >
                  &#9998;
                </button>
                <button
                  onClick={() => onRemoveGoal(index)}
                  className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-gray-800 transition-colors text-sm"
                  title="Удалить"
                >
                  &#10005;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
