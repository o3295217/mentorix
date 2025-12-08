'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { monthNames } from '@/lib/goals-utils'

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


  // Цветовая схема
  const yearColors = distance === 0 
    ? 'from-emerald-500 to-teal-500 border-emerald-300 bg-emerald-50'
    : distance === 1 
    ? 'from-blue-500 to-cyan-500 border-blue-300 bg-blue-50'
    : distance <= 3
    ? 'from-purple-500 to-pink-500 border-purple-300 bg-purple-50'
    : 'from-amber-500 to-orange-500 border-amber-300 bg-amber-50'

  const headerBg = distance === 0 
    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100' 
    : distance === 1 
    ? 'bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100' 
    : distance <= 3 
    ? 'bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100' 
    : 'bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100'

  const borderColor = distance === 0 ? 'border-emerald-200' : distance === 1 ? 'border-blue-200' : distance <= 3 ? 'border-purple-200' : 'border-amber-200'
  const textColor = distance === 0 ? 'text-emerald-600' : distance === 1 ? 'text-blue-600' : distance <= 3 ? 'text-purple-600' : 'text-amber-600'
  const badgeColor = distance === 0 ? 'bg-emerald-100 text-emerald-700' : distance === 1 ? 'bg-blue-100 text-blue-700' : distance <= 3 ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
  const buttonColor = distance === 0 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : distance === 1 ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : distance <= 3 ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'

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

  const getDetailLevel = (): 'month' | 'quarter' | 'half' | 'year' => {
    if (distance === 0) return 'month'
    if (distance === 1) return 'quarter'
    if (distance <= 3) return 'half'
    return 'year'
  }
  
  const detailLevel = getDetailLevel()

  // Мемоизация вычисления copiedTo для каждой цели
  const goalsWithCopiedTo = useMemo(() => {
    return goals.map(goal => {
      const copiedTo: { type: 'quarter' | 'month' | 'week'; label: string; key: string }[] = []
      const goalLower = goal.trim().toLowerCase()
      
      // Проверяем кварталы
      ;[1, 2, 3, 4].forEach(q => {
        const qKey = `${year}-Q${q}`
        const qGoals = periodGoals.get(qKey) || []
        if (qGoals.some(g => g.trim().toLowerCase() === goalLower)) {
          copiedTo.push({ type: 'quarter', label: `Q${q}`, key: qKey })
        }
      })
      
      // Проверяем месяцы
      monthNames.forEach((mName, mIdx) => {
        const mKey = `${year}-${String(mIdx + 1).padStart(2, '0')}`
        const mGoals = periodGoals.get(mKey) || []
        if (mGoals.some(g => g.trim().toLowerCase() === goalLower)) {
          copiedTo.push({ type: 'month', label: mName.slice(0, 3), key: mKey })
        }
      })
      
      // Проверяем недели (только для текущего года)
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
    <div className={`rounded-xl border-2 ${borderColor} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}>
      {/* Заголовок года */}
      <button
        onClick={onToggle}
        className={`w-full px-4 py-3 flex items-center justify-between ${headerBg} transition-colors`}
      >
        <div className="flex items-center gap-3">
          <span className={`w-10 h-10 rounded-lg bg-gradient-to-br ${yearColors.split(' ')[0]} ${yearColors.split(' ')[1]} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
            {isExpanded ? '▼' : '▶'}
          </span>
          <div className="text-left">
            <span className="font-bold text-lg block">
              🎯 {year} {distance === 0 && <span className="text-emerald-600 text-sm font-normal">(текущий)</span>}
            </span>
            <span className={`text-sm ${textColor}`}>
              {goals.length > 0 ? `${goals.length} ${goals.length === 1 ? 'цель' : goals.length < 5 ? 'цели' : 'целей'}` : 'Добавьте цели →'}
            </span>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${badgeColor}`}>
          {distance === 0 ? 'Сейчас' : `+${distance} ${distance === 1 ? 'год' : distance < 5 ? 'года' : 'лет'}`}
        </div>
      </button>

      {/* Содержимое года */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 bg-white">
          {/* Цели на год */}
          <div className="pt-4">
            <h4 className={`font-semibold mb-3 flex items-center gap-2 ${distance === 0 ? 'text-emerald-700' : distance === 1 ? 'text-blue-700' : distance <= 3 ? 'text-purple-700' : 'text-amber-700'}`}>
              <span className="text-lg">🎯</span>
              Цели на {year} год:
            </h4>

            {/* Поле добавления новой цели */}
            <div className="mb-3 flex gap-2">
              <input
                type="text"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Введите цель и нажмите Enter..."
                className={`flex-1 px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 ${borderColor} focus:ring-opacity-50`}
              />
              <button
                onClick={handleAdd}
                className={`px-4 py-2 rounded-lg font-medium text-white transition-all hover:scale-105 ${buttonColor}`}
              >
                + Добавить
              </button>
            </div>

            {/* Список целей */}
            <div className="space-y-2">
              {goals.length === 0 ? (
                <div className={`text-center py-6 rounded-lg border-2 border-dashed ${borderColor} bg-opacity-10`}>
                  <span className="text-3xl block mb-2">🎯</span>
                  <p className="text-gray-500 text-sm">Добавьте цели на {year} год...</p>
                </div>
              ) : (
                goalsWithCopiedTo.map(({ goal, copiedTo }, index) => {
                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg border-l-4 bg-white shadow-sm hover:shadow transition-shadow ${distance === 0 ? 'border-l-emerald-400' : distance === 1 ? 'border-l-blue-400' : distance <= 3 ? 'border-l-purple-400' : 'border-l-amber-400'}`}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${distance === 0 ? 'bg-emerald-500' : distance === 1 ? 'bg-blue-500' : distance <= 3 ? 'bg-purple-500' : 'bg-amber-500'}`}>
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
                          className="flex-1 px-2 py-1 border-2 border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                          autoFocus
                        />
                      ) : (
                        <div className="flex-1 flex items-center gap-2 flex-wrap">
                          {copiedTo.length > 0 ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                // Переход к первому месту нахождения цели
                                const firstCopy = copiedTo[0]
                                let elementId = ''
                                if (firstCopy.type === 'quarter') {
                                  elementId = `quarter-${firstCopy.key}`
                                } else if (firstCopy.type === 'month') {
                                  elementId = `month-${firstCopy.key}`
                                } else if (firstCopy.type === 'week') {
                                  elementId = `week-${firstCopy.key}`
                                }
                                const element = document.getElementById(elementId)
                                if (element) {
                                  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                  element.classList.add('ring-4', 'ring-blue-400', 'ring-opacity-75')
                                  setTimeout(() => {
                                    element.classList.remove('ring-4', 'ring-blue-400', 'ring-opacity-75')
                                  }, 2000)
                                }
                              }}
                              className="text-left text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                              title="Перейти к цели"
                            >
                              {goal}
                            </button>
                          ) : (
                            <span className="transition-colors">
                              {goal}
                            </span>
                          )}
                          
                          {/* Бейджи — где скопирована задача */}
                          {copiedTo.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {copiedTo.map((c, i) => (
                                <button 
                                  key={i}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // Определяем ID элемента для скроллинга
                                    let elementId = ''
                                    if (c.type === 'quarter') {
                                      elementId = `quarter-${c.key}`
                                    } else if (c.type === 'month') {
                                      elementId = `month-${c.key}`
                                    } else if (c.type === 'week') {
                                      elementId = `week-${c.key}`
                                    }
                                    const element = document.getElementById(elementId)
                                    if (element) {
                                      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                      // Подсветка элемента
                                      element.classList.add('ring-4', 'ring-blue-400', 'ring-opacity-75')
                                      setTimeout(() => {
                                        element.classList.remove('ring-4', 'ring-blue-400', 'ring-opacity-75')
                                      }, 2000)
                                    }
                                  }}
                                  className={`text-xs px-2 py-1 rounded-md border font-medium cursor-pointer hover:scale-105 transition-transform ${
                                    c.type === 'quarter' ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100' : 
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

                      {/* Кнопка копирования */}
                      {(detailLevel === 'month' || detailLevel === 'quarter') && (
                        <div className="relative" ref={copyDropdownIndex === index ? dropdownRef : null}>
                          <button
                            onClick={() => setCopyDropdownIndex(copyDropdownIndex === index ? null : index)}
                            className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded p-1 transition-colors"
                            title="Копировать в период"
                          >
                            ↓
                          </button>
                          {copyDropdownIndex === index && (
                            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[160px] max-h-[400px] overflow-y-auto">
                              <div className="px-3 py-1 text-xs text-gray-500 font-medium border-b border-gray-100">Кварталы</div>
                              {[1, 2, 3, 4].map(q => (
                                <button
                                  key={q}
                                  onClick={() => {
                                    onCopyGoal(goal, 'quarter', `${year}-Q${q}`)
                                    setCopyDropdownIndex(null)
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 transition-colors"
                                >
                                  → Q{q}
                                </button>
                              ))}
                              <div className="px-3 py-1 text-xs text-gray-500 font-medium border-b border-t border-gray-100 mt-1">Месяцы</div>
                              {monthNames.map((mName, mIdx) => (
                                <button
                                  key={mIdx}
                                  onClick={() => {
                                    onCopyGoal(goal, 'month', `${year}-${String(mIdx + 1).padStart(2, '0')}`)
                                    setCopyDropdownIndex(null)
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 transition-colors"
                                >
                                  → {mName}
                                </button>
                              ))}
                              
                              {/* Недели текущего месяца */}
                              {year === currentYear && (() => {
                                const today = new Date()
                                const currMonth = today.getMonth()
                                const weeksData: { num: number; start: Date; end: Date }[] = []
                                const firstD = new Date(year, currMonth, 1)
                                const lastD = new Date(year, currMonth + 1, 0)
                                let curr = new Date(firstD)
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
                        className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded p-1 transition-colors"
                        title="Редактировать"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onRemoveGoal(index)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full p-1 transition-colors"
                        title="Удалить цель"
                      >
                        ✕
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Детализация по периодам (Children) */}
          {children}
        </div>
      )}
    </div>
  )
}
