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
  periodGoals: Map<string, string[]> // For checking if copied to months
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

  const quarterColors = ['from-rose-400 to-pink-500', 'from-amber-400 to-orange-500', 'from-emerald-400 to-teal-500', 'from-blue-400 to-indigo-500']
  const quarterBgColors = ['bg-rose-50 border-rose-200', 'bg-amber-50 border-amber-200', 'bg-emerald-50 border-emerald-200', 'bg-blue-50 border-indigo-200']
  const quarterTextColors = ['text-rose-600', 'text-amber-600', 'text-emerald-600', 'text-blue-600']
  
  const colorIndex = quarter - 1


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
    <div id={`quarter-${year}-Q${quarter}`} className={`rounded-lg border-2 overflow-hidden ${quarterBgColors[colorIndex]}`}>
      <button
        onClick={onToggle}
        className={`w-full px-3 py-2 flex items-center justify-between hover:bg-white/50 transition-colors`}
      >
        <div className="flex items-center gap-2 flex-1">
          <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${quarterColors[colorIndex]} flex items-center justify-center text-white text-sm shadow-sm`}>
            {isExpanded ? '▼' : '▶'}
          </span>
          <span className="font-semibold">
            📊 Q{quarter}
            {isCurrent && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">сейчас</span>}
          </span>
          <span className={`text-sm ${quarterTextColors[colorIndex]}`}>
            {goals.length} {goals.length === 1 ? 'цель' : goals.length < 5 ? 'цели' : 'целей'}
          </span>
          {/* Прогресс-бар квартала */}
          {goals.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all bg-gradient-to-r ${quarterColors[colorIndex]}`}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 font-medium">{progress.completed}/{progress.total}</span>
            </div>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 bg-white/70">
          {/* Поле добавления новой цели для квартала */}
          <div className="flex gap-2 pt-2">
            <input
              type="text"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder={`Цель на Q${quarter}...`}
              className="flex-1 px-3 py-1.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
            <button
              onClick={handleAdd}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r ${quarterColors[colorIndex]} hover:opacity-90 transition-opacity`}
            >
              +
            </button>
          </div>

          {/* Список целей квартала */}
          <div className="space-y-1">
            {goals.length === 0 ? (
              <p className="text-gray-400 text-xs text-center py-2">
                Нет целей на Q{quarter}
              </p>
            ) : (
              goals.map((goal, index) => {
                // Поиск где скопирована эта задача (месяцы и недели)
                const copiedTo: { type: 'month' | 'week'; label: string; key: string }[] = []
                const goalLower = goal.trim().toLowerCase()
                
                // Проверяем месяцы квартала
                ;[0, 1, 2].forEach(offset => {
                  const m = (quarter - 1) * 3 + offset
                  const mKey = `${year}-${String(m + 1).padStart(2, '0')}`
                  const mGoals = periodGoals.get(mKey) || []
                  if (mGoals.some(g => g.trim().toLowerCase() === goalLower)) {
                    copiedTo.push({ type: 'month', label: monthNames[m].slice(0, 3), key: mKey })
                  }
                })
                
                // Проверяем недели текущего месяца (если квартал текущий)
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
                    className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-100 shadow-sm"
                  >
                    <span className={`w-5 h-5 rounded-full bg-gradient-to-br ${quarterColors[colorIndex]} flex items-center justify-center text-white text-xs`}>
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
                        className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                        autoFocus
                      />
                    ) : (
                      <div className="flex-1 flex items-center gap-2 flex-wrap">
                        {copiedTo.length > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const firstCopy = copiedTo[0]
                              const elementId = firstCopy.type === 'month' 
                                ? `month-${firstCopy.key}` 
                                : `week-${firstCopy.key}`
                              const element = document.getElementById(elementId)
                              if (element) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                element.classList.add('ring-4', 'ring-blue-400', 'ring-opacity-75')
                                setTimeout(() => {
                                  element.classList.remove('ring-4', 'ring-blue-400', 'ring-opacity-75')
                                }, 2000)
                              }
                            }}
                            className="text-sm text-left text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                            title="Перейти к цели"
                          >
                            {goal}
                          </button>
                        ) : (
                          <span className="text-sm">{goal}</span>
                        )}
                        {/* Бейджи */}
                        {copiedTo.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {copiedTo.map((c, i) => (
                              <button 
                                key={i}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const elementId = c.type === 'month' 
                                    ? `month-${c.key}` 
                                    : `week-${c.key}`
                                  const element = document.getElementById(elementId)
                                  if (element) {
                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                    element.classList.add('ring-4', 'ring-blue-400', 'ring-opacity-75')
                                    setTimeout(() => {
                                      element.classList.remove('ring-4', 'ring-blue-400', 'ring-opacity-75')
                                    }, 2000)
                                  }
                                }}
                                className={`text-[10px] px-1.5 py-0.5 rounded border font-medium cursor-pointer hover:scale-105 transition-transform ${
                                  c.type === 'month' ? 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100' : 
                                  'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                                }`}
                                title={`Перейти к ${c.label}`}
                              >
                                {c.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Кнопка копирования в месяц/неделю */}
                    {onCopyGoal && (
                      <div className="relative" ref={copyDropdownIndex === index ? dropdownRef : null}>
                        <button
                          onClick={() => setCopyDropdownIndex(copyDropdownIndex === index ? null : index)}
                          className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded p-1 transition-colors"
                          title="Копировать в период"
                        >
                          ↓
                        </button>
                        {copyDropdownIndex === index && (
                          <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[140px] max-h-[300px] overflow-y-auto">
                            <div className="px-3 py-1 text-xs text-gray-500 font-medium border-b border-gray-100">Месяцы Q{quarter}</div>
                            {[0, 1, 2].map(offset => {
                              const m = (quarter - 1) * 3 + offset
                              return (
                                <button
                                  key={m}
                                  onClick={() => {
                                    onCopyGoal(goal, 'month', `${year}-${String(m + 1).padStart(2, '0')}`)
                                    setCopyDropdownIndex(null)
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 transition-colors"
                                >
                                  → {monthNames[m]}
                                </button>
                              )
                            })}
                            {/* Недели текущего месяца */}
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
                                  <div className="px-3 py-1 text-xs text-gray-500 font-medium border-b border-t border-gray-100 mt-1">
                                    Недели {monthNames[currMonth]}
                                  </div>
                                  {weeksData.map(w => (
                                    <button
                                      key={w.num}
                                      onClick={() => {
                                        onCopyGoal(goal, 'week', `${year}-${String(currMonth + 1).padStart(2, '0')}-W${w.num}`)
                                        setCopyDropdownIndex(null)
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-amber-50 transition-colors"
                                    >
                                      → W{w.num} ({w.start.getDate()}-{w.end.getDate()})
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
                      className="text-gray-400 hover:text-blue-600 p-1"
                      title="Редактировать"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onRemoveGoal(index)}
                      className="text-gray-400 hover:text-red-600 p-1"
                      title="Удалить"
                    >
                      ✕
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Детализация по месяцам (Children) */}
          {children}
        </div>
      )}
    </div>
  )
}
