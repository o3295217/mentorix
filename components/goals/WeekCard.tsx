'use client'

import { useEffect, useRef, useState } from 'react'
import { Goal, GoalTag } from '@/lib/types'
import { parseDateParam, toDateKey } from '@/lib/dates'
import { formatWeekRange, fuzzyMatchGoal } from '@/lib/goals-utils'

interface WeekData {
  num: number
  key: string
  start: Date
  end: Date
}

const TAG_COLOR_PRESETS = [
  '#3B82F6',
  '#8B5CF6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#6B7280',
]

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
  dragOverWeek?: string | null
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
  // Layout variant: 'card' = standalone card, 'grid' = cell inside MonthSection grid
  variant?: 'card' | 'grid'
  // Controlled input (for grid variant)
  newGoalValue?: string
  onNewGoalChange?: (value: string) => void
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
  onSetGoalPriority,
  searchQuery,
  filterStatus,
  filterPriority,
  filterTag,
  variant = 'card',
  newGoalValue,
  onNewGoalChange,
}: WeekCardProps) {
  const weekKey = week.key
  const isGrid = variant === 'grid'
  const isDragOver = dragOverWeek === weekKey
  const [editingWeekGoal, setEditingWeekGoal] = useState<{ weekKey: string; index: number } | null>(null)
  const [editingWeekText, setEditingWeekText] = useState('')
  const newGoalTextareaRef = useRef<HTMLTextAreaElement>(null)
  const editingTextareaRef = useRef<HTMLTextAreaElement>(null)
  // Tag selection for new goal
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showNewTagInput, setShowNewTagInput] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLOR_PRESETS[5])
  // Tag editing for existing goal
  const [editingTagsGoal, setEditingTagsGoal] = useState<string | null>(null)

  const getExpandedMinHeight = (element: HTMLTextAreaElement) => {
    const savedHeight = Number(element.dataset.collapsedHeight || 0)
    if (savedHeight > 0) return savedHeight * 2

    const baseHeight = Math.ceil(element.getBoundingClientRect().height)
    element.dataset.collapsedHeight = String(baseHeight)
    return baseHeight * 2
  }

  const resizeTextarea = (element: HTMLTextAreaElement, minHeight = 0) => {
    element.style.height = 'auto'
    element.style.height = `${Math.max(element.scrollHeight, minHeight)}px`
  }

  const expandTextarea = (element: HTMLTextAreaElement) => {
    resizeTextarea(element, getExpandedMinHeight(element))
  }

  const resetTextareaHeight = (element: HTMLTextAreaElement) => {
    element.style.height = ''
  }

  const submitNewGoal = () => {
    const textarea = newGoalTextareaRef.current
    const text = textarea?.value.trim()

    if (!textarea || !text) return

    onAddWeekGoal(weekKey, text, selectedTags.length > 0 ? selectedTags : undefined)
    if (onNewGoalChange) onNewGoalChange('')
    else textarea.value = ''
    setSelectedTags([])
    resetTextareaHeight(textarea)
  }

  useEffect(() => {
    if (!editingWeekGoal) return

    const frameId = requestAnimationFrame(() => {
      const textarea = editingTextareaRef.current
      if (!textarea) return
      expandTextarea(textarea)
    })

    return () => cancelAnimationFrame(frameId)
  }, [editingWeekGoal])

  return (
    <div
      id={`week-${weekKey}`}
      className={isGrid
        ? `flex min-w-0 flex-col rounded-xl border border-slate-800 bg-slate-950/60 p-3 lg:rounded-none lg:border-0 ${isDragOver ? 'ring-1 ring-blue-500/50 bg-blue-500/5' : ''}`
        : `rounded-2xl p-3 border transition-all ${
            isCurrentWeek
              ? 'border-blue-500/30 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.06),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]'
              : 'border-slate-700 bg-slate-800/20'
          } ${isDragOver ? 'ring-1 ring-blue-500/50' : ''}`
      }
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
      {/* Заголовок */}
      {isGrid ? (
        <div className="mb-2 pb-2 border-b border-slate-800/60 flex items-baseline gap-2">
          <div className={`text-sm font-semibold ${isCurrentWeek ? 'text-blue-400' : 'text-slate-400'}`}>
            Неделя {week.num}
          </div>
          <div className={`text-[11px] ${isCurrentWeek ? 'text-blue-400/60' : 'text-slate-600'}`}>
            {formatWeekRange(week)}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-sm font-semibold ${isCurrentWeek ? 'text-blue-400' : 'text-slate-400'}`}>
            Неделя {week.num}: {formatWeekRange(week)}
          </span>
          {isCurrentWeek && <span className="text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">сейчас</span>}
        </div>
      )}

      {/* Добавление цели в неделю */}
      <div className="mb-2">
        <div className="flex min-w-0 items-end gap-1">
          <textarea
            ref={newGoalTextareaRef}
            value={onNewGoalChange ? (newGoalValue || '') : undefined}
            onChange={(e) => {
              if (onNewGoalChange) onNewGoalChange(e.target.value)
              expandTextarea(e.target)
            }}
            onFocus={(e) => expandTextarea(e.target)}
            onBlur={(e) => {
              if (e.target.value.trim()) resizeTextarea(e.target)
              else resetTextareaHeight(e.target)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submitNewGoal()
              }
            }}
            placeholder={isGrid ? '+ задача' : 'Цель на неделю...'}
            className={isGrid
              ? 'min-h-11 min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-slate-800 bg-transparent px-2 py-2 text-base leading-6 text-slate-300 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500/50 lg:text-xs lg:leading-5'
              : 'min-h-11 min-w-0 flex-1 resize-none overflow-hidden rounded-xl border border-slate-700 bg-slate-950/50 px-2 py-2 text-base leading-6 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 lg:text-xs lg:leading-5'
            }
            rows={1}
          />
          <button
            type="button"
            onClick={submitNewGoal}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500 text-sm text-white transition-colors hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            aria-label={`Добавить цель в неделю ${week.num}`}
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
                  type="button"
                  key={tag.id}
                  onClick={() => setSelectedTags(prev =>
                    isSelected ? prev.filter(t => t !== tag.name) : [...prev, tag.name]
                  )}
                  className={`inline-flex min-h-11 items-center rounded-full px-3 py-2 text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:min-h-0 lg:px-1.5 lg:py-0.5 lg:text-[10px] ${
                    isSelected ? 'ring-1 ring-offset-1 ring-offset-slate-900' : 'opacity-50 hover:opacity-80'
                  }`}
                  aria-pressed={isSelected}
                  aria-label={`${isSelected ? 'Убрать' : 'Добавить'} тег «${tag.name}» для новой цели`}
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
              type="button"
              onClick={() => setShowNewTagInput(!showNewTagInput)}
              className="min-h-11 rounded-lg px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:min-h-0 lg:px-1 lg:py-0 lg:text-[10px]"
              aria-expanded={showNewTagInput}
            >
              + тег
            </button>
          </div>
        )}
        {(showNewTagInput || tags.length === 0) && (
          <div className="mt-1 space-y-1.5">
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
              className="min-h-11 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 lg:w-28 lg:text-xs"
            />
            <div className="flex items-center gap-1 flex-wrap">
              {TAG_COLOR_PRESETS.map((preset) => {
                const isSelected = preset === newTagColor
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNewTagColor(preset)}
                    className={`h-11 w-11 rounded-full border-[12px] border-slate-900 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:h-7 lg:w-7 lg:border-[6px] ${isSelected ? 'ring-1 ring-white/60' : 'hover:ring-1 hover:ring-slate-500'}`}
                    style={{ backgroundColor: preset }}
                    aria-label={`Выбрать цвет ${preset}`}
                    aria-pressed={isSelected}
                  />
                )
              })}
              {newTagName.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    onCreateTag(newTagName.trim(), newTagColor)
                    setNewTagName('')
                    setShowNewTagInput(false)
                  }}
                  className="flex h-11 min-w-11 items-center justify-center rounded-lg bg-blue-500 px-3 text-sm text-white transition-colors hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                  aria-label={`Создать тег «${newTagName.trim()}»`}
                >
                  +
                </button>
              )}
            </div>
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
              g.periodKey === weekKey && fuzzyMatchGoal(g.text, goal)
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
              g.periodKey === weekKey && fuzzyMatchGoal(g.text, goal)
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
                    ref={editingTextareaRef}
                    value={editingWeekText}
                    onChange={(e) => {
                      setEditingWeekText(e.target.value)
                      expandTextarea(e.target)
                    }}
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
                    className="min-h-11 w-full resize-none overflow-hidden rounded-lg border border-blue-500/50 bg-slate-900 px-2 py-2 text-base leading-6 focus:outline-none focus:ring-1 focus:ring-blue-500/50 lg:text-xs lg:leading-5"
                    rows={1}
                    autoFocus
                  />
                ) : (
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      draggable={false}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!isProcessing) onToggleGoalCompletion(weekKey, goal, !isCompleted)
                      }}
                      className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${isProcessing ? 'cursor-wait opacity-50' : 'cursor-pointer'}`}
                      aria-label={`${isCompleted ? 'Отметить невыполненной' : 'Отметить выполненной'} цель «${goal}»`}
                      aria-pressed={isCompleted}
                    >
                      <span className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                        isCompleted ? 'border-green-500 bg-green-500' : 'border-slate-600 bg-transparent'
                      }`} aria-hidden="true">
                        {isCompleted && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>}
                      </span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`break-words text-sm [overflow-wrap:anywhere] ${isLongText ? 'min-h-11 cursor-pointer' : ''} ${isLongText && !isGoalExpanded ? 'line-clamp-2' : ''} ${isCompleted ? 'text-slate-500' : 'text-slate-200'}`}
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
                      {trackedGoal?.parentId && (() => {
                        const parentGoal = trackedGoals.find(g => g.id === trackedGoal.parentId)
                        return parentGoal ? (
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate" title={parentGoal.text}>
                            ↑ {parentGoal.text.length > 35 ? parentGoal.text.slice(0, 35) + '…' : parentGoal.text}
                          </div>
                        ) : null
                      })()}
                      {goalDeadline && (
                        <div className={`inline-flex items-center gap-1.5 text-xs mt-0.5 ${isDeadlineOverdue ? 'text-red-400 font-medium' : 'text-slate-500'}`}>
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 3v3m10-3v3M4.5 9.5h15M6 5h12a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z" />
                          </svg>
                          <span>{parseDateParam(goalDeadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      )}
                      {/* Теги цели */}
                      {(trackedGoal?.tags || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(trackedGoal?.tags || []).map(tagName => {
                            const tagInfo = tags.find(t => t.name === tagName)
                            return (
                              <span
                                key={tagName}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                                style={{
                                  backgroundColor: (tagInfo?.color || '#6B7280') + '30',
                                  color: tagInfo?.color || '#9CA3AF',
                                  border: `1px solid ${(tagInfo?.color || '#6B7280')}50`,
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
                <div className="mt-1 flex flex-wrap justify-end gap-1">
                  <select
                    value={goalPriority}
                    disabled={isProcessing}
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation()
                      if (!isProcessing) onSetGoalPriority(weekKey, goal, parseInt(e.target.value))
                    }}
                    aria-label="Приоритет цели"
                    className={`min-h-11 max-w-full rounded-lg border bg-slate-900 px-2 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:min-h-0 lg:py-0.5 lg:text-xs ${
                      goalPriority >= 2
                        ? 'border-red-500/40 text-red-300'
                        : goalPriority === 1
                          ? 'border-amber-500/40 text-amber-300'
                          : 'border-slate-700 text-slate-300'
                    } ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                  >
                    <option value="0">Без приоритета</option>
                    <option value="1">Средний</option>
                    <option value="2">Высокий</option>
                  </select>
                  <button
                    type="button"
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setEditingTagsGoal(editingTagsGoal === goalKey ? null : goalKey)}
                    className={`flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:min-h-0 lg:min-w-0 lg:py-0.5 lg:text-[10px] ${
                      editingTagsGoal === goalKey
                        ? 'text-blue-400 bg-blue-500/10'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                    }`}
                    title="Теги"
                    aria-label={`Изменить теги цели «${goal}»`}
                    aria-expanded={editingTagsGoal === goalKey}
                    aria-controls={`week-goal-tags-${weekKey}-${index}`}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    тег
                  </button>
                  <button
                    type="button"
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => { setEditingWeekGoal({ weekKey, index }); setEditingWeekText(goal) }}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-xs text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:h-7 lg:w-7"
                    aria-label={`Редактировать цель «${goal}»`}
                  >
                    &#9998;
                  </button>
                  <button
                    type="button"
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => onRemoveWeekGoal(weekKey, index)}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-xs text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 lg:h-7 lg:w-7"
                    aria-label={`Удалить цель «${goal}»`}
                  >
                    &#10005;
                  </button>
                </div>
                {/* Выбор тегов для существующей цели */}
                {editingTagsGoal === goalKey && tags.length > 0 && (
                  <div id={`week-goal-tags-${weekKey}-${index}`} className="mt-1 flex flex-wrap gap-1 border-t border-slate-700/50 pt-1">
                    {tags.map(tag => {
                      const currentTags = trackedGoal?.tags || []
                      const isActive = currentTags.includes(tag.name)
                      return (
                        <button
                          type="button"
                          key={tag.id}
                          onClick={() => {
                            const newTags = isActive
                              ? currentTags.filter(t => t !== tag.name)
                              : [...currentTags, tag.name]
                            onSetGoalTags(weekKey, goal, newTags)
                          }}
                          className={`inline-flex min-h-11 items-center rounded-full px-3 py-2 text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:min-h-0 lg:px-1.5 lg:py-0.5 lg:text-[10px] ${
                            isActive ? 'ring-1 ring-offset-1 ring-offset-slate-900' : 'opacity-40 hover:opacity-70'
                          }`}
                          aria-pressed={isActive}
                          aria-label={`${isActive ? 'Убрать' : 'Добавить'} тег «${tag.name}» у цели «${goal}»`}
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
