'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Goal } from '@/lib/types'
import { monthNames } from '@/lib/goals-utils'

interface MonthSectionProps {
  month: number // 0-11
  year: number
  goals: string[]
  isExpanded: boolean
  isCurrent: boolean
  progress: { total: number; completed: number; percent: number }
  onToggle: () => void
  onAddGoal: (text: string) => void
  onRemoveGoal: (index: number) => void
  onEditGoal: (index: number, text: string) => void
  periodGoals: Map<string, string[]>
  trackedGoals: Goal[]
  onCopyGoal: (goal: string, targetType: 'week', targetKey: string) => void
  
  // Props for Week rendering (passed through)
  showAllPeriods: boolean
  draggedGoal: { weekKey: string; index: number; goal: string } | null
  setDraggedGoal: (goal: { weekKey: string; index: number; goal: string } | null) => void
  dragOverWeek: string | null
  setDragOverWeek: (weekKey: string | null) => void
  onMoveGoal: (fromWeekKey: string, toWeekKey: string, index: number, goal: string) => void
  onAddWeekGoal: (weekKey: string, text: string) => void
  onRemoveWeekGoal: (weekKey: string, index: number) => void
  onEditWeekGoal: (weekKey: string, index: number, text: string) => void
  
  // Goal Tracking Props
  processingGoals: Set<string>
  expandedGoals: Set<string>
  setExpandedGoals: (callback: (prev: Set<string>) => Set<string>) => void
  onToggleGoalCompletion: (weekKey: string, text: string, completed: boolean) => void
  onSetGoalPriority: (weekKey: string, text: string, priority: number) => void
}

export default function MonthSection({
  month,
  year,
  goals,
  isExpanded,
  isCurrent,
  progress,
  onToggle,
  onAddGoal,
  onRemoveGoal,
  onEditGoal,
  periodGoals,
  trackedGoals,
  onCopyGoal,
  showAllPeriods,
  draggedGoal,
  setDraggedGoal,
  dragOverWeek,
  setDragOverWeek,
  onMoveGoal,
  onAddWeekGoal,
  onRemoveWeekGoal,
  onEditWeekGoal,
  processingGoals,
  expandedGoals,
  setExpandedGoals,
  onToggleGoalCompletion,
  onSetGoalPriority
}: MonthSectionProps) {
  const [newGoal, setNewGoal] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const [copyDropdownIndex, setCopyDropdownIndex] = useState<number | null>(null)
  
  // State for editing week goals
  const [editingWeekGoal, setEditingWeekGoal] = useState<{ weekKey: string, index: number } | null>(null)
  const [editingWeekText, setEditingWeekText] = useState('')

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


  const monthColors = ['bg-gradient-to-r from-sky-400 to-blue-500', 'bg-gradient-to-r from-violet-400 to-purple-500', 'bg-gradient-to-r from-pink-400 to-rose-500']
  const monthGradients = ['from-sky-400 to-blue-500', 'from-violet-400 to-purple-500', 'from-pink-400 to-rose-500']
  
  // Determine color based on month index in quarter (0, 1, 2)
  const monthOffset = month % 3

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

  // Helper to calculate weeks in this month - мемоизация
  const weeksInMonth = useMemo(() => {
    const weeks: { num: number; key: string; start: Date; end: Date }[] = []
    const firstD = new Date(year, month, 1)
    const lastD = new Date(year, month + 1, 0)
    const curr = new Date(firstD)
    while (curr.getDay() !== 1) curr.setDate(curr.getDate() + 1)
    
    let wNum = 1
    while (curr <= lastD) {
      const wStart = new Date(curr)
      const wEnd = new Date(curr)
      wEnd.setDate(wEnd.getDate() + 6)
      weeks.push({ 
        num: wNum, 
        key: `${year}-${String(month + 1).padStart(2, '0')}-W${wNum}`,
        start: wStart,
        end: wEnd
      })
      curr.setDate(curr.getDate() + 7)
      wNum++
    }
    return weeks
  }, [year, month])

  // Мемоизация goalsWithWeeks - тяжёлое вычисление
  const goalsWithWeeks = useMemo(() => {
    return goals.map((goal, origIndex) => {
      const goalLower = goal.trim().toLowerCase()
      const inWeeks: number[] = []
      weeksInMonth.forEach(w => {
        const wGoals = periodGoals.get(w.key) || []
        if (wGoals.some(g => g.trim().toLowerCase() === goalLower)) {
          inWeeks.push(w.num)
        }
      })
      return { goal, origIndex, inWeeks, minWeek: inWeeks.length > 0 ? Math.min(...inWeeks) : 999 }
    })
  }, [goals, periodGoals, weeksInMonth])

  // Helper to calculate progress for a specific week
  const calculateWeekProgress = (weekKey: string) => {
    const wGoals = periodGoals.get(weekKey) || []
    const total = wGoals.length
    const completed = wGoals.filter(goalText => {
      const tracked = trackedGoals.find(g => g.periodKey === weekKey && g.text === goalText)
      return tracked?.completed
    }).length
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, percent }
  }

  const isOverdue = (deadline: string | null): boolean => {
    if (!deadline) return false
    return new Date(deadline) < new Date()
  }

  return (
    <div id={`month-${year}-${String(month + 1).padStart(2, '0')}`} className={`rounded-lg p-3 ${isCurrent ? 'bg-gradient-to-r from-sky-50 to-blue-50 border-2 border-sky-200' : 'bg-gray-50 border border-gray-100'}`}>
      <div 
        className="flex items-center gap-2 mb-2 cursor-pointer"
        onClick={onToggle}
      >
        <span className={`w-7 h-7 rounded-lg ${monthColors[monthOffset]} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
          {isExpanded ? '▼' : '▶'}
        </span>
        <span className="font-medium text-sm">
          {monthNames[month]}
          {isCurrent && <span className="ml-2 text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">сейчас</span>}
        </span>
        <span className="text-xs text-gray-500">
          ({goals.length} {goals.length === 1 ? 'цель' : goals.length < 5 ? 'цели' : 'целей'})
        </span>
        {/* Прогресс-бар месяца */}
        {progress.total > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all bg-gradient-to-r ${monthGradients[monthOffset]}`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{progress.percent}%</span>
          </div>
        )}
      </div>

      {/* Контент месяца */}
      {isExpanded && (
        <>
          {/* Поле добавления цели для месяца */}
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Добавить цель..."
              className="flex-1 px-3 py-1.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={(e) => { e.stopPropagation(); handleAdd() }}
              className={`${monthColors[monthOffset]} text-white text-sm px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity`}
            >
              +
            </button>
          </div>

          {/* Список целей месяца */}
          <div className="space-y-1">
            {goals.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-2">
                Нет целей
              </p>
            ) : (
              (() => {
                // Сортируем: сначала не разнесённые (minWeek=999), потом по неделям
                const sorted = [...goalsWithWeeks].sort((a, b) => {
                  if (a.minWeek === 999 && b.minWeek !== 999) return -1
                  if (a.minWeek !== 999 && b.minWeek === 999) return 1
                  return a.minWeek - b.minWeek
                })
                
                return sorted.map(({ goal, origIndex, inWeeks }, displayIndex) => (
                  <div
                    key={origIndex}
                    className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-100 shadow-sm"
                  >
                    <span className={`w-5 h-5 rounded-full ${monthColors[monthOffset]} flex items-center justify-center text-white text-xs`}>
                      {displayIndex + 1}
                    </span>
                    {editingIndex === origIndex ? (
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={() => handleSaveEdit(origIndex)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(origIndex)
                          if (e.key === 'Escape') { setEditingIndex(null); setEditingText('') }
                        }}
                        className="flex-1 px-2 py-0.5 text-sm border-2 border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                        autoFocus
                      />
                    ) : (
                      <div className="flex-1 flex items-center gap-2 flex-wrap">
                        {inWeeks.length > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const weekKey = `${year}-${String(month + 1).padStart(2, '0')}-W${inWeeks[0]}`
                              const element = document.getElementById(`week-${weekKey}`)
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
                        {/* Бейджи недель */}
                        {inWeeks.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {inWeeks.map(wNum => {
                              const weekKey = `${year}-${String(month + 1).padStart(2, '0')}-W${wNum}`
                              return (
                                <button 
                                  key={wNum}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const element = document.getElementById(`week-${weekKey}`)
                                    if (element) {
                                      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                      element.classList.add('ring-4', 'ring-blue-400', 'ring-opacity-75')
                                      setTimeout(() => {
                                        element.classList.remove('ring-4', 'ring-blue-400', 'ring-opacity-75')
                                      }, 2000)
                                    }
                                  }}
                                  className="text-xs px-2 py-1 rounded-md border bg-amber-50 text-amber-700 border-amber-300 font-medium cursor-pointer hover:bg-amber-100 hover:scale-105 transition-transform"
                                  title={`Перейти к W${wNum}`}
                                >
                                  W{wNum}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Кнопка копирования в неделю (только для текущего месяца) */}
                    {isCurrent && (
                      <div className="relative" ref={copyDropdownIndex === origIndex ? dropdownRef : null}>
                        <button
                          onClick={() => setCopyDropdownIndex(copyDropdownIndex === origIndex ? null : origIndex)}
                          className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded p-1 transition-colors"
                          title="Копировать в неделю"
                        >
                          ↓
                        </button>
                        {copyDropdownIndex === origIndex && (
                          <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[100px]">
                            {weeksInMonth.map(w => (
                              <button
                                key={w.num}
                                onClick={() => {
                                  onCopyGoal(goal, 'week', w.key)
                                  setCopyDropdownIndex(null)
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors"
                              >
                                → Неделя {w.num}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <button
                      onClick={() => {
                        setEditingIndex(origIndex)
                        setEditingText(goal)
                      }}
                      className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded p-1 transition-colors text-xs"
                      title="Редактировать"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onRemoveGoal(origIndex)}
                      className="text-red-400 hover:text-red-600 text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                ))
              })()
            )}
          </div>

          {/* Недели для текущего месяца */}
          {isCurrent && (
            <div className="border-t border-gray-100 mt-3 pt-3">
              <p className="text-xs text-gray-500 font-medium mb-2">✨ Недели месяца:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {weeksInMonth.map((week, idx) => {
                  const weekKey = week.key
                  const weekGoals = periodGoals.get(weekKey) || []
                  const today = new Date()
                  const isCurrentWeek = today >= week.start && today <= week.end
                  const isDragOver = dragOverWeek === weekKey

                  // Скрываем пустые недели
                  if (weekGoals.length === 0 && !showAllPeriods && !isCurrentWeek && !draggedGoal) {
                    return null
                  }

                  const weekProgress = calculateWeekProgress(weekKey)

                  return (
                    <div 
                      key={weekKey} 
                      id={`week-${weekKey}`} 
                      className={`rounded-lg p-3 flex flex-col transition-all ${
                        isDragOver 
                          ? 'bg-blue-100 border-2 border-blue-400 border-dashed scale-105' 
                          : isCurrentWeek 
                            ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-amber-200' 
                            : 'bg-white border border-gray-100'
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        if (draggedGoal && draggedGoal.weekKey !== weekKey) {
                          setDragOverWeek(weekKey)
                        }
                      }}
                      onDragLeave={() => setDragOverWeek(null)}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (draggedGoal && draggedGoal.weekKey !== weekKey) {
                          onMoveGoal(draggedGoal.weekKey, weekKey, draggedGoal.index, draggedGoal.goal)
                        }
                        setDraggedGoal(null)
                        setDragOverWeek(null)
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-7 h-7 rounded-full ${isCurrentWeek ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-gray-400 to-gray-500'} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                          W{week.num}
                        </span>
                        <div className="flex flex-col flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {week.start.getDate()}-{week.end.getDate()}
                            </span>
                            {weekProgress.total > 0 && (
                              <span className="text-xs text-gray-400">{weekProgress.completed}/{weekProgress.total}</span>
                            )}
                          </div>
                          {isCurrentWeek && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full w-fit">сейчас</span>}
                          {/* Прогресс-бар недели */}
                          {weekProgress.total > 0 && (
                            <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mt-1">
                              <div 
                                className={`h-full rounded-full transition-all ${isCurrentWeek ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-gray-400 to-gray-500'}`}
                                style={{ width: `${weekProgress.percent}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Поле добавления цели для недели */}
                      <div className="flex gap-1 mb-2">
                        <input
                          type="text"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const target = e.target as HTMLInputElement
                              if (target.value.trim()) {
                                onAddWeekGoal(weekKey, target.value)
                                target.value = ''
                              }
                            }
                          }}
                          placeholder="Цель..."
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                        />
                        <button
                          onClick={(e) => {
                            const input = e.currentTarget.previousElementSibling as HTMLInputElement
                            if (input.value.trim()) {
                              onAddWeekGoal(weekKey, input.value)
                              input.value = ''
                            }
                          }}
                          className={`${isCurrentWeek ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-gray-400 to-gray-500'} text-white text-xs px-2 py-1 rounded-lg hover:opacity-90 transition-opacity`}
                        >
                          +
                        </button>
                      </div>

                      {/* Список целей недели */}
                      <div className="space-y-1 flex-1 min-h-[40px]">
                        {weekGoals.length === 0 ? (
                          <p className={`text-gray-400 text-xs text-center py-2 ${isDragOver ? 'text-blue-500' : ''}`}>
                            {isDragOver ? '⬇️ Отпустите здесь' : '—'}
                          </p>
                        ) : (
                          weekGoals.map((goal, index) => {
                            const goalKey = `week-${weekKey}-${index}`
                            const lockKey = `${weekKey}-${goal}`
                            const isProcessing = processingGoals.has(lockKey)
                            const isExpanded = expandedGoals.has(goalKey)
                            const isLongText = goal.length > 50
                            const isDragging = draggedGoal?.weekKey === weekKey && draggedGoal?.index === index
                            
                            const trackedGoal = trackedGoals.find(g => 
                              g.periodKey === weekKey && 
                              (g.text === goal || g.text.startsWith(goal.slice(0, 30)) || goal.startsWith(g.text.slice(0, 30)))
                            )
                            
                            const isCompleted = trackedGoal?.completed || false
                            const goalDeadline = trackedGoal?.deadline
                            const isDeadlineOverdue = goalDeadline && isOverdue(goalDeadline) && !isCompleted
                            const goalPriority = trackedGoal?.priority || 0
                            
                            return (
                              <div
                                key={index}
                                draggable
                                onDragStart={() => setDraggedGoal({ weekKey, index, goal })}
                                onDragEnd={() => {
                                  setDraggedGoal(null)
                                  setDragOverWeek(null)
                                }}
                                className={`p-1.5 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing transition-all ${
                                  isDragging ? 'opacity-50 scale-95' : 'hover:shadow-md'
                                } ${isCompleted ? 'bg-green-50/80 border-green-200' : isDeadlineOverdue ? 'bg-red-50/80 border-red-300' : 'bg-white/80 border-gray-100 hover:border-gray-200'}`}
                              >
                                {editingWeekGoal?.weekKey === weekKey && editingWeekGoal?.index === index ? (
                                  <textarea
                                    value={editingWeekText}
                                    onChange={(e) => setEditingWeekText(e.target.value)}
                                    onBlur={() => {
                                      if (editingWeekText.trim()) {
                                        onEditWeekGoal(weekKey, index, editingWeekText)
                                      }
                                      setEditingWeekGoal(null)
                                      setEditingWeekText('')
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        if (editingWeekText.trim()) {
                                          onEditWeekGoal(weekKey, index, editingWeekText)
                                        }
                                        setEditingWeekGoal(null)
                                        setEditingWeekText('')
                                      }
                                      if (e.key === 'Escape') { 
                                        setEditingWeekGoal(null)
                                        setEditingWeekText('') 
                                      }
                                    }}
                                    className="w-full px-2 py-1 text-xs border-2 border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                                    rows={3}
                                    autoFocus
                                  />
                                ) : (
                                  <div className="flex items-start gap-1.5">
                                    <input
                                      type="checkbox"
                                      checked={isCompleted}
                                      disabled={isProcessing}
                                      onChange={(e) => {
                                        e.stopPropagation()
                                        if (isProcessing) return
                                        onToggleGoalCompletion(weekKey, goal, !isCompleted)
                                      }}
                                      className={`w-4 h-4 mt-0.5 rounded border-gray-300 text-green-500 focus:ring-green-400 flex-shrink-0 ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div 
                                        className={`text-xs ${isLongText ? 'cursor-pointer' : ''} ${isLongText && !isExpanded ? 'line-clamp-3' : ''} ${isCompleted ? 'line-through text-gray-400' : ''}`}
                                        onClick={() => {
                                          if (isLongText) {
                                            setExpandedGoals(prev => {
                                              const next = new Set(prev)
                                              if (next.has(goalKey)) next.delete(goalKey)
                                              else next.add(goalKey)
                                              return next
                                            })
                                          }
                                        }}
                                        title={isLongText ? (isExpanded ? "Свернуть" : "Развернуть") : ""}
                                      >
                                        {goal}
                                        {isLongText && !isExpanded && <span className="text-blue-500 ml-1">...</span>}
                                      </div>
                                      {goalDeadline && (
                                        <div className={`text-xs mt-0.5 ${isDeadlineOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                                          ⏰ {new Date(goalDeadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                <div className="flex justify-end gap-1 mt-1">
                                  <select
                                    value={goalPriority}
                                    disabled={isProcessing}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      if (isProcessing) return
                                      onSetGoalPriority(weekKey, goal, parseInt(e.target.value))
                                    }}
                                    className={`text-xs px-1 py-0.5 border border-gray-200 rounded bg-white hover:bg-gray-50 ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                                    title="Приоритет"
                                  >
                                    <option value="0">⚪</option>
                                    <option value="1">🟡</option>
                                    <option value="2">🔴</option>
                                  </select>
                                  <button
                                    onClick={() => {
                                      setEditingWeekGoal({ weekKey, index })
                                      setEditingWeekText(goal)
                                    }}
                                    className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded p-0.5 transition-colors text-xs"
                                    title="Редактировать"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => onRemoveWeekGoal(weekKey, index)}
                                    className="text-red-400 hover:text-red-600 text-xs px-1 hover:bg-red-50 rounded transition-colors"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
