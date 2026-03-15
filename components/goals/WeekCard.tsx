'use client'

import { useState } from 'react'
import { Goal, GoalTag } from '@/lib/types'
import { parseDateParam, toDateKey } from '@/lib/dates'
import { WeekData } from './WeekStrip'

interface WeekCardProps {
  week: WeekData
  weekGoals: string[]
  isCurrentWeek: boolean
  trackedGoals: Goal[]
  // Tags
  tags: GoalTag[]
  onCreateTag: (name: string, color: string) => void
  onSetGoalTags: (weekKey: string, text: string, tags: string[]) => void
  // Drag
  draggedGoal: { weekKey: string; index: number; goal: string } | null
  setDraggedGoal: (goal: { weekKey: string; index: number; goal: string } | null) => void
  setDragOverWeek: (weekKey: string | null) => void
  onMoveGoal: (fromWeekKey: string, toWeekKey: string, index: number, goal: string) => void
  // CRUD
  onAddWeekGoal: (weekKey: string, text: string, tags?: string[]) => void
  onRemoveWeekGoal: (weekKey: string, index: number) => void
  onEditWeekGoal: (weekKey: string, index: number, text: string) => void
  // Tracking
  processingGoals: Set<string>
  expandedGoals: Set<string>
  setExpandedGoals: (callback: (prev: Set<string>) => Set<string>) => void
  onToggleGoalCompletion: (weekKey: string, text: string, completed: boolean) => void
  onSetGoalPriority: (weekKey: string, text: string, priority: number) => void
  // Filters
  searchQuery: string
  filterStatus: 'all' | 'active' | 'completed'
  filterPriority: number | null
  filterTag: string | null
}

const isOverdue = (deadline: string | null): boolean => {
  if (!deadline) return false
  return toDateKey(parseDateParam(deadline)) < toDateKey(new Date())
}

export default function WeekCard({
  week,
  weekGoals,
  isCurrentWeek,
  trackedGoals,
  tags,
  onCreateTag,
  onSetGoalTags,
  draggedGoal,
  setDraggedGoal,
  setDragOverWeek,
  onMoveGoal,
  onAddWeekGoal,
  onRemoveWeekGoal,
  onEditWeekGoal,
  processingGoals,
  expandedGoals,
  setExpandedGoals,
  onToggleGoalCompletion,
  onSetGoalPriority,
  searchQuery,
  filterStatus,
  filterPriority,
  filterTag,
}: WeekCardProps) {
  const weekKey = week.key
  const [editingWeekGoal, setEditingWeekGoal] = useState<{ weekKey: string; index: number } | null>(null)
  const [editingWeekText, setEditingWeekText] = useState('')
  // Tag selection for new goal
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showNewTagInput, setShowNewTagInput] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6B7280')
  // Tag editing for existing goal
  const [editingTagsGoal, setEditingTagsGoal] = useState<string | null>(null)

  return (
    <div
      id={`week-${weekKey}`}
      className={`rounded-2xl p-3 border transition-all ${
        isCurrentWeek
          ? 'border-blue-500/30 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.06),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]'
          : 'border-slate-700 bg-slate-800/20'
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        if (draggedGoal && draggedGoal.weekKey !== weekKey) setDragOverWeek(weekKey)
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
        <span className={`text-xs font-semibold ${isCurrentWeek ? 'text-blue-400' : 'text-slate-400'}`}>
          Неделя {week.num}: {week.start.getDate()}-{week.end.getDate()}
        </span>
        {isCurrentWeek && <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">сейчас</span>}
      </div>

      {/* Добавление цели в неделю */}
      <div className="mb-2">
        <div className="flex gap-1">
          <input
            type="text"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const target = e.target as HTMLInputElement
                if (target.value.trim()) {
                  onAddWeekGoal(weekKey, target.value, selectedTags.length > 0 ? selectedTags : undefined)
                  target.value = ''
                  setSelectedTags([])
                }
              }
            }}
            placeholder="Цель на неделю..."
            className="flex-1 px-2 py-1 text-xs border border-slate-700 rounded-xl bg-slate-950/50 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-slate-600"
          />
          <button
            onClick={(e) => {
              const input = e.currentTarget.parentElement?.querySelector('input[type="text"]') as HTMLInputElement
              if (input?.value.trim()) {
                onAddWeekGoal(weekKey, input.value, selectedTags.length > 0 ? selectedTags : undefined)
                input.value = ''
                setSelectedTags([])
              }
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded-lg transition-colors"
          >
            +
          </button>
        </div>
        {/* Теги для новой цели */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {tags.map(tag => {
              const isSelected = selectedTags.includes(tag.name)
              return (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTags(prev =>
                    isSelected ? prev.filter(t => t !== tag.name) : [...prev, tag.name]
                  )}
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] transition-all ${
                    isSelected ? 'ring-1 ring-offset-1 ring-offset-slate-900' : 'opacity-50 hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: tag.color + '20',
                    color: tag.color,
                    ...(isSelected ? { ringColor: tag.color } : {}),
                  }}
                >
                  {tag.name}
                </button>
              )
            })}
            <button
              onClick={() => setShowNewTagInput(!showNewTagInput)}
              className="text-[10px] text-slate-500 hover:text-slate-300 px-1 transition-colors"
            >
              + тег
            </button>
          </div>
        )}
        {(showNewTagInput || tags.length === 0) && (
          <div className="flex items-center gap-1 mt-1">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTagName.trim()) {
                  onCreateTag(newTagName.trim(), newTagColor)
                  setNewTagName('')
                  setShowNewTagInput(false)
                }
              }}
              placeholder="Новый тег..."
              className="px-1.5 py-0.5 text-[10px] border border-slate-700 rounded w-20 bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-slate-600"
            />
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              className="w-4 h-4 rounded cursor-pointer border-0"
            />
            {newTagName.trim() && (
              <button
                onClick={() => {
                  onCreateTag(newTagName.trim(), newTagColor)
                  setNewTagName('')
                  setShowNewTagInput(false)
                }}
                className="px-1 py-0.5 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                +
              </button>
            )}
          </div>
        )}
      </div>

      {/* Цели недели */}
      <div className="space-y-1">
        {weekGoals.length === 0 ? (
          <p className="text-slate-600 text-xs text-center py-2">Нет целей</p>
        ) : (() => {
          const filtered = weekGoals.filter((goal) => {
            if (searchQuery && !goal.toLowerCase().includes(searchQuery.toLowerCase())) return false
            const tracked = trackedGoals.find(g =>
              g.periodKey === weekKey &&
              (g.text === goal || g.text.startsWith(goal.slice(0, 30)) || goal.startsWith(g.text.slice(0, 30)))
            )
            if (filterStatus === 'completed' && !tracked?.completed) return false
            if (filterStatus === 'active' && tracked?.completed) return false
            if (filterPriority !== null && (tracked?.priority || 0) !== filterPriority) return false
            if (filterTag && !(tracked?.tags || []).includes(filterTag)) return false
            return true
          })
          return filtered.length === 0 ? (
            <p className="text-slate-600 text-xs text-center py-2">Нет целей по фильтру</p>
          ) : filtered.map((goal) => {
            const index = weekGoals.indexOf(goal)
            const lockKey = `${weekKey}-${goal}`
            const isProcessing = processingGoals.has(lockKey)
            const goalKey = `week-${weekKey}-${index}`
            const isGoalExpanded = expandedGoals.has(goalKey)
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
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', goal)
                  setDraggedGoal({ weekKey, index, goal })
                }}
                onDragEnd={() => { setDraggedGoal(null); setDragOverWeek(null) }}
                style={{ touchAction: 'none', userSelect: 'none' }}
                className={`p-1.5 rounded-lg border transition-all select-none cursor-grab active:cursor-grabbing ${
                  isDragging ? 'opacity-50 scale-95' : ''
                } ${
                  isCompleted
                    ? 'bg-green-900/15 border-green-700/50'
                    : isDeadlineOverdue
                      ? 'bg-red-900/15 border-red-700/50'
                      : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
                }`}
              >
                {editingWeekGoal?.weekKey === weekKey && editingWeekGoal?.index === index ? (
                  <textarea
                    value={editingWeekText}
                    onChange={(e) => setEditingWeekText(e.target.value)}
                    onBlur={() => {
                      if (editingWeekText.trim()) onEditWeekGoal(weekKey, index, editingWeekText)
                      setEditingWeekGoal(null); setEditingWeekText('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (editingWeekText.trim()) onEditWeekGoal(weekKey, index, editingWeekText)
                        setEditingWeekGoal(null); setEditingWeekText('')
                      }
                      if (e.key === 'Escape') { setEditingWeekGoal(null); setEditingWeekText('') }
                    }}
                    className="w-full px-2 py-1 text-xs border border-blue-500/50 rounded bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
                    rows={3}
                    autoFocus
                  />
                ) : (
                  <div className="flex items-start gap-1.5">
                    <input
                      type="checkbox"
                      checked={isCompleted}
                      disabled={isProcessing}
                      draggable={false}
                      onMouseDown={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation()
                        if (!isProcessing) onToggleGoalCompletion(weekKey, goal, !isCompleted)
                      }}
                      className={`w-3.5 h-3.5 mt-0.5 rounded border-slate-600 text-green-500 focus:ring-green-400 flex-shrink-0 ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-xs ${isLongText ? 'cursor-pointer' : ''} ${isLongText && !isGoalExpanded ? 'line-clamp-2' : ''} ${isCompleted ? 'line-through text-slate-500' : 'text-slate-200'}`}
                        onClick={() => {
                          if (isLongText) {
                            setExpandedGoals(prev => {
                              const next = new Set(prev)
                              if (next.has(goalKey)) next.delete(goalKey); else next.add(goalKey)
                              return next
                            })
                          }
                        }}
                      >
                        {goal}
                      </div>
                      {goalDeadline && (
                        <div className={`text-[10px] mt-0.5 ${isDeadlineOverdue ? 'text-red-400 font-medium' : 'text-slate-500'}`}>
                          ⏰ {parseDateParam(goalDeadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                        </div>
                      )}
                      {/* Теги цели */}
                      {(trackedGoal?.tags || []).length > 0 && (
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {(trackedGoal?.tags || []).map(tagName => {
                            const tagInfo = tags.find(t => t.name === tagName)
                            return (
                              <span
                                key={tagName}
                                className="inline-block px-1 py-0 rounded text-[9px]"
                                style={{
                                  backgroundColor: (tagInfo?.color || '#6B7280') + '20',
                                  color: tagInfo?.color || '#6B7280',
                                }}
                              >
                                {tagName}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-1 mt-1">
                  <select
                    value={goalPriority}
                    disabled={isProcessing}
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation()
                      if (!isProcessing) onSetGoalPriority(weekKey, goal, parseInt(e.target.value))
                    }}
                    className={`text-xs px-1 py-0.5 border border-slate-700 rounded bg-slate-900 text-slate-300 ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                  >
                    <option value="0">⚪</option>
                    <option value="1">🟡</option>
                    <option value="2">🔴</option>
                  </select>
                  <button
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setEditingTagsGoal(editingTagsGoal === goalKey ? null : goalKey)}
                    className={`p-0.5 rounded transition-colors text-xs ${
                      editingTagsGoal === goalKey
                        ? 'text-blue-400 bg-blue-500/10'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                    }`}
                    title="Теги"
                  >
                    🏷
                  </button>
                  <button
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => { setEditingWeekGoal({ weekKey, index }); setEditingWeekText(goal) }}
                    className="text-slate-500 hover:text-slate-300 p-0.5 rounded hover:bg-slate-800 transition-colors text-xs"
                  >
                    &#9998;
                  </button>
                  <button
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => onRemoveWeekGoal(weekKey, index)}
                    className="text-slate-500 hover:text-red-400 px-1 rounded hover:bg-slate-800 transition-colors text-xs"
                  >
                    &#10005;
                  </button>
                </div>
                {/* Выбор тегов для существующей цели */}
                {editingTagsGoal === goalKey && tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-slate-700/50">
                    {tags.map(tag => {
                      const currentTags = trackedGoal?.tags || []
                      const isActive = currentTags.includes(tag.name)
                      return (
                        <button
                          key={tag.id}
                          onClick={() => {
                            const newTags = isActive
                              ? currentTags.filter(t => t !== tag.name)
                              : [...currentTags, tag.name]
                            onSetGoalTags(weekKey, goal, newTags)
                          }}
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] transition-all ${
                            isActive ? 'ring-1 ring-offset-1 ring-offset-slate-900' : 'opacity-40 hover:opacity-70'
                          }`}
                          style={{
                            backgroundColor: tag.color + '20',
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        })()}
      </div>
    </div>
  )
}
