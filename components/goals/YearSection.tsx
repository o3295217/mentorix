'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { monthNames } from '@/lib/goals-utils'
import { getDetailLevel } from '@/lib/dates'

interface YearSectionProps {
  year: number
  currentYear: number
  goals: string[]
  isExpanded: boolean
  onToggle: () => void
  onAddGoal: (text: string) => void
  onRemoveGoal: (index: number) => void
  onEditGoal: (index: number, text: string) => void
  periodGoals: Map<string, string[]>
  onCopyGoal: (goal: string, targetType: 'quarter' | 'month' | 'week', targetKey: string) => void
  children?: React.ReactNode
}

export default function YearSection({
  year,
  currentYear,
  goals,
  isExpanded,
  onToggle,
  onAddGoal,
  onRemoveGoal,
  onEditGoal,
  periodGoals,
  onCopyGoal,
  children
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

  const distance = year - currentYear
  const isCurrent = distance === 0

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
    <div className="group">
      {/* Заголовок года — чистый аккордеон */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 py-3 px-1 border-b transition-colors ${
          isCurrent ? 'border-blue-500/30' : 'border-gray-800'
        } hover:bg-gray-900/40 rounded-t-lg`}
      >
        <span className="text-gray-500 text-sm w-4 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▸
        </span>
        <span className="font-bold text-lg">
          {year}
        </span>
        {isCurrent && (
          <span className="text-xs text-blue-400 font-normal">(текущий)</span>
        )}
        <span className="text-sm text-gray-500">
          {goals.length > 0
            ? `${goals.length} ${goals.length === 1 ? 'цель' : goals.length < 5 ? 'цели' : 'целей'}`
            : 'Добавьте цели \u2192'}
        </span>
        <span className="ml-auto text-xs text-gray-600 font-medium">
          {distance === 0 ? 'Сейчас' : `+${distance} ${distance === 1 ? 'год' : distance < 5 ? 'года' : 'лет'}`}
        </span>
      </button>

      {/* Содержимое года */}
      {isExpanded && (
        <div className="pl-5 pb-6 space-y-4 border-l border-gray-800 ml-2 mt-2">
          {/* Заголовок целей */}
          <h4 className="text-sm font-medium text-gray-400">
            Цели на {year} год:
          </h4>

          {/* Добавление */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Введите цель и нажмите Enter..."
              className="input text-sm"
            />
            <button onClick={handleAdd} className="btn-primary text-sm whitespace-nowrap">
              + Добавить
            </button>
          </div>

          {/* Список целей */}
          <div className="space-y-1.5">
            {goals.length === 0 ? (
              <p className="text-gray-600 text-sm py-4 text-center">Добавьте цели на {year} год...</p>
            ) : (
              goalsWithCopiedTo.map(({ goal, copiedTo }, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2.5 py-2 px-3 rounded-lg hover:bg-gray-900/50 transition-colors group/item"
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
                      {copiedTo.length > 0 ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const first = copiedTo[0]
                            const id = first.type === 'quarter' ? `quarter-${first.key}` : first.type === 'month' ? `month-${first.key}` : `week-${first.key}`
                            scrollToElement(id)
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
                                const id = c.type === 'quarter' ? `quarter-${c.key}` : c.type === 'month' ? `month-${c.key}` : `week-${c.key}`
                                scrollToElement(id)
                              }}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200 hover:border-gray-600 transition-colors cursor-pointer"
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Действия — показываются при наведении */}
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
              ))
            )}
          </div>

          {/* Детализация (Children) */}
          {children}
        </div>
      )}
    </div>
  )
}
