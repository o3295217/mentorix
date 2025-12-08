'use client'

import { useState, useEffect } from 'react'
import { getDetailLevel } from '@/lib/dates'
import { monthNames, parseWeekKey } from '@/lib/goals-utils'
import { useGoals, useGoalsCopy } from '@/hooks'
import DreamSection from '@/components/goals/DreamSection'
import YearSection from '@/components/goals/YearSection'
import QuarterSection from '@/components/goals/QuarterSection'
import MonthSection from '@/components/goals/MonthSection'
import HalfYearSection from '@/components/goals/HalfYearSection'

export default function GoalsPage() {
  // Используем хуки для управления целями
  const {
    dreamGoal,
    saveDream,
    yearGoals,
    loadYearGoals,
    addYearGoal,
    removeYearGoal,
    editYearGoal,
    periodGoals,
    loadPeriodGoalsWithKey,
    loadAllWeeksForMonth,
    savePeriodGoals,
    addPeriodGoal,
    removePeriodGoal,
    editPeriodGoal,
    goals,
    processingGoals,
    setGoalPriority,
    setGoalCompleted,
    tags,
    createTag: createTagApi,
    deleteTag,
    calculatePeriodProgress,
    showMessage,
    message,
    currentYear,
  } = useGoals()

  // Обёртка для создания тега с использованием локального состояния
  const handleCreateTag = () => {
    if (newTagName.trim()) {
      createTagApi(newTagName.trim(), newTagColor)
      setNewTagName('')
    }
  }

  const {
    copyDropdown,
    setCopyDropdown,
  } = useGoalsCopy()

  // Локальные UI-состояния
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set([new Date().getFullYear()]))
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set())
  const [showAllPeriods, setShowAllPeriods] = useState(false)
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set())
  const [draggedGoal, setDraggedGoal] = useState<{ weekKey: string; index: number; goal: string } | null>(null)
  const [dragOverWeek, setDragOverWeek] = useState<string | null>(null)

  // Фильтры и поиск
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all')
  const [filterPriority, setFilterPriority] = useState<number | null>(null)
  const [filterTag, setFilterTag] = useState<string | null>(null)

  // Управление тегами
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6B7280')

  // Глобальные горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && copyDropdown) {
        setCopyDropdown(null)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        const searchInput = document.querySelector('input[placeholder*="Поиск"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        showMessage('⌨️ Горячие клавиши: Esc=отмена, Ctrl+F=поиск, Enter=сохранить')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [copyDropdown, setCopyDropdown, showMessage])

  // Закрытие dropdown при клике вне
  useEffect(() => {
    const handleClickOutside = () => {
      if (copyDropdown) setCopyDropdown(null)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [copyDropdown, setCopyDropdown])

  // Загрузка данных при появлении dreamGoal
  useEffect(() => {
    if (dreamGoal) {
      const years = Array.from({ length: dreamGoal.years }, (_, i) => currentYear + i)
      years.forEach(year => loadYearGoals(year))

      const today = new Date()
      const currentMonth = today.getMonth()
      const currentQuarter = Math.floor(currentMonth / 3) + 1
      const quarterKey = `${currentYear}-Q${currentQuarter}`

      setExpandedPeriods(prev => new Set(prev).add(quarterKey))

      for (let q = 1; q <= 4; q++) {
        loadPeriodGoalsWithKey('quarter', new Date(currentYear, (q - 1) * 3, 1))
      }
      for (let m = 0; m < 12; m++) {
        loadPeriodGoalsWithKey('month', new Date(currentYear, m, 1))
      }
      loadAllWeeksForMonth(currentYear, currentMonth)
    }
  }, [dreamGoal, currentYear, loadYearGoals, loadPeriodGoalsWithKey, loadAllWeeksForMonth])

  const toggleYear = (year: number) => {
    setExpandedYears(prev => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }



  // Перемещение задачи между неделями (drag-and-drop)
  const moveGoalBetweenWeeks = (fromWeekKey: string, toWeekKey: string, goalIndex: number, goalText: string) => {
    if (fromWeekKey === toWeekKey) return
    const fromParsed = parseWeekKey(fromWeekKey)
    const toParsed = parseWeekKey(toWeekKey)
    removePeriodGoal(fromWeekKey, goalIndex, 'week', fromParsed.weekStart, `Неделя ${fromParsed.weekNum}`)
    addPeriodGoal(toWeekKey, 'week', toParsed.weekStart, `Неделя ${toParsed.weekNum}`, goalText)
    showMessage(`✅ Задача перемещена в W${toParsed.weekNum}`)
  }

  // Обёртка для сохранения редактирования periodGoal
  const saveEditPeriodGoal = (periodKey: string, index: number, periodType: 'quarter' | 'month' | 'week' | 'half_year', date: Date, label: string, text: string) => {
    editPeriodGoal(periodKey, index, periodType, date, label, text)
  }

  // Обёртка для копирования целей (через addPeriodGoal)
  const handleCopyGoal = (goal: string, targetType: 'quarter' | 'month' | 'week', targetKey: string) => {
    const year = parseInt(targetKey.split('-')[0])
    
    if (targetType === 'quarter') {
      const quarter = parseInt(targetKey.split('-Q')[1])
      const quarterDate = new Date(year, (quarter - 1) * 3, 1)
      addPeriodGoal(targetKey, 'quarter', quarterDate, `Q${quarter} ${year}`, goal)
    } else if (targetType === 'month') {
      const month = parseInt(targetKey.split('-')[1]) - 1
      const monthDate = new Date(year, month, 1)
      addPeriodGoal(targetKey, 'month', monthDate, monthNames[month], goal)
    } else if (targetType === 'week') {
      const parsed = parseWeekKey(targetKey)
      addPeriodGoal(targetKey, 'week', parsed.weekStart, `Неделя ${parsed.weekNum}`, goal)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Управление целями</h1>

      {/* Панель поиска и фильтров */}
      <div className="card bg-white border border-gray-200">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Поиск */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Поиск целей..."
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
            />
          </div>
          
          {/* Фильтр по статусу */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'completed')}
            className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="all">📋 Все</option>
            <option value="active">⏳ Активные</option>
            <option value="completed">✅ Выполненные</option>
          </select>
          
          {/* Фильтр по приоритету */}
          <select
            value={filterPriority ?? ''}
            onChange={(e) => setFilterPriority(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">🎯 Все приоритеты</option>
            <option value="3">🔴 Высокий</option>
            <option value="2">🟡 Средний</option>
            <option value="1">🟢 Низкий</option>
            <option value="0">⚪ Без приоритета</option>
          </select>
          
          {/* Фильтр по тегу */}
          <select
            value={filterTag ?? ''}
            onChange={(e) => setFilterTag(e.target.value || null)}
            className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">🏷️ Все теги</option>
            {(tags || []).map(tag => (
              <option key={tag.id} value={tag.name}>{tag.name}</option>
            ))}
          </select>
        </div>
        
        {/* Управление тегами */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-500 font-medium">Теги:</span>
            {(tags || []).map(tag => (
              <span 
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}` }}
              >
                {tag.name}
                <button 
                  onClick={() => deleteTag(tag.id)}
                  className="ml-1 hover:opacity-70"
                >
                  ✕
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1 ml-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                placeholder="Новый тег..."
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg w-24 focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer"
              />
              <button
                onClick={handleCreateTag}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Секция Мечты */}
      <DreamSection
        dreamGoal={dreamGoal}
        onSave={saveDream}
      />

      {/* Иерархическое дерево целей */}
      {dreamGoal && (
        <div className="card bg-gradient-to-br from-slate-50 to-blue-50">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-2 rounded-lg">📊</span>
            План достижения мечты
          </h2>

          <div className="space-y-3">
            {Array.from({ length: dreamGoal.years }, (_, i) => {
              const year = currentYear + i
              const isExpanded = expandedYears.has(year)
              const yearGoalsList = yearGoals.get(year) || []
              const detailLevel = getDetailLevel(year)

              return (
                <YearSection
                  key={year}
                  year={year}
                  currentYear={currentYear}
                  goals={yearGoalsList}
                  isExpanded={isExpanded}
                  onToggle={() => toggleYear(year)}
                  onAddGoal={(text) => addYearGoal(year, text)}
                  onRemoveGoal={(index) => removeYearGoal(year, index)}
                  onEditGoal={(index, text) => editYearGoal(year, index, text)}
                  periodGoals={periodGoals}
                  onCopyGoal={handleCopyGoal}
                >
                  {detailLevel !== 'year' && (
                    <div className="border-t border-gray-100 pt-4 space-y-3">
                      <h4 className="font-semibold text-gray-600 text-sm flex items-center gap-2">
                        <span>📋</span>
                        Детализация по периодам:
                      </h4>

                      {(detailLevel === 'month' || detailLevel === 'quarter') && (
                        <div className="space-y-2">
                          {[1, 2, 3, 4].map(quarter => {
                            const quarterKey = `${year}-Q${quarter}`
                            const quarterGoals = periodGoals.get(quarterKey) || []
                            const isQuarterExpanded = expandedPeriods.has(quarterKey)
                            const quarterDate = new Date(year, (quarter - 1) * 3, 1)
                            const isCurrentQuarter = year === currentYear && quarter === Math.floor(new Date().getMonth() / 3) + 1
                            const progress = calculatePeriodProgress(quarterKey)

                            return (
                              <QuarterSection
                                key={quarterKey}
                                quarter={quarter}
                                year={year}
                                goals={quarterGoals}
                                isExpanded={isQuarterExpanded}
                                isCurrent={isCurrentQuarter}
                                progress={progress}
                                onToggle={() => {
                                  const newExpanded = new Set(expandedPeriods)
                                  if (newExpanded.has(quarterKey)) {
                                    newExpanded.delete(quarterKey)
                                  } else {
                                    newExpanded.add(quarterKey)
                                    loadPeriodGoalsWithKey('quarter', quarterDate)
                                  }
                                  setExpandedPeriods(newExpanded)
                                }}
                                onAddGoal={(text) => addPeriodGoal(quarterKey, 'quarter', quarterDate, `Q${quarter} ${year}`, text)}
                                onRemoveGoal={(index) => removePeriodGoal(quarterKey, index, 'quarter', quarterDate, `Q${quarter} ${year}`)}
                                onEditGoal={(index, text) => editPeriodGoal(quarterKey, index, 'quarter', quarterDate, `Q${quarter} ${year}`, text)}
                                onCopyGoal={handleCopyGoal}
                                periodGoals={periodGoals}
                              >
                                {detailLevel === 'month' && (
                                  <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-base text-gray-500 font-medium">📅 Детализация по месяцам:</p>
                                      <button
                                        onClick={() => setShowAllPeriods(!showAllPeriods)}
                                        className="text-base text-blue-500 hover:text-blue-700 transition-colors px-3 py-1.5 rounded hover:bg-blue-50"
                                      >
                                        {showAllPeriods ? '🙈 Скрыть пустые' : '👁 Показать все'}
                                      </button>
                                    </div>
                                    {[0, 1, 2].map(monthOffset => {
                                      const month = (quarter - 1) * 3 + monthOffset
                                      const monthDate = new Date(year, month, 1)
                                      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
                                      const monthGoals = periodGoals.get(monthKey) || []
                                      const isCurrentMonth = year === currentYear && month === new Date().getMonth()

                                      // Скрываем пустые месяцы, если не включён showAllPeriods (кроме текущего)
                                      if (monthGoals.length === 0 && !showAllPeriods && !isCurrentMonth) {
                                        return null
                                      }

                                      const isMonthCollapsed = collapsedMonths.has(monthKey)
                                      const monthProgress = calculatePeriodProgress(monthKey)

                                      return (
                                        <MonthSection
                                          key={monthKey}
                                          month={month}
                                          year={year}
                                          goals={monthGoals}
                                          isExpanded={!isMonthCollapsed}
                                          isCurrent={isCurrentMonth}
                                          progress={monthProgress}
                                          onToggle={() => setCollapsedMonths(prev => {
                                            const next = new Set(prev)
                                            if (next.has(monthKey)) next.delete(monthKey)
                                            else next.add(monthKey)
                                            return next
                                          })}
                                          onAddGoal={(text) => addPeriodGoal(monthKey, 'month', monthDate, monthNames[month], text)}
                                          onRemoveGoal={(index) => removePeriodGoal(monthKey, index, 'month', monthDate, monthNames[month])}
                                          onEditGoal={(index, text) => saveEditPeriodGoal(monthKey, index, 'month', monthDate, monthNames[month], text)}
                                          periodGoals={periodGoals}
                                          trackedGoals={goals}
                                          onCopyGoal={(goal, targetType, targetKey) => {
                                            const parsed = parseWeekKey(targetKey)
                                            // Просто добавляем цель в неделю
                                            addPeriodGoal(targetKey, 'week', parsed.weekStart, `Неделя ${parsed.weekNum}`, goal)
                                          }}
                                          showAllPeriods={showAllPeriods}
                                          draggedGoal={draggedGoal}
                                          setDraggedGoal={setDraggedGoal}
                                          dragOverWeek={dragOverWeek}
                                          setDragOverWeek={setDragOverWeek}
                                          onMoveGoal={moveGoalBetweenWeeks}
                                          onAddWeekGoal={(weekKey, text) => {
                                            const parsed = parseWeekKey(weekKey)
                                            addPeriodGoal(weekKey, 'week', parsed.weekStart, `Неделя ${parsed.weekNum}`, text)
                                          }}
                                          onRemoveWeekGoal={(weekKey, index) => {
                                            const parsed = parseWeekKey(weekKey)
                                            removePeriodGoal(weekKey, index, 'week', parsed.weekStart, `Неделя ${parsed.weekNum}`)
                                          }}
                                          onEditWeekGoal={(weekKey, index, text) => {
                                            const parsed = parseWeekKey(weekKey)
                                            saveEditPeriodGoal(weekKey, index, 'week', parsed.weekStart, `Неделя ${parsed.weekNum}`, text)
                                          }}
                                          processingGoals={processingGoals}
                                          expandedGoals={expandedGoals}
                                          setExpandedGoals={setExpandedGoals}
                                          onToggleGoalCompletion={setGoalCompleted}
                                          onSetGoalPriority={setGoalPriority}
                                        />
                                      )
                                    })}
                                  </div>
                                )}
                              </QuarterSection>
                            )
                          })}
                        </div>
                      )}

                      {/* Полугодия для дальних лет */}
                      {detailLevel === 'half' && (
                        <div className="space-y-2">
                          {[1, 2].map(half => {
                            const halfKey = `${year}-H${half}`
                            const halfGoals = periodGoals.get(halfKey) || []
                            const halfDate = new Date(year, (half - 1) * 6, 1)

                            return (
                              <HalfYearSection
                                key={halfKey}
                                half={half}
                                year={year}
                                goals={halfGoals}
                                onAddGoal={(text) => addPeriodGoal(halfKey, 'half_year', halfDate, `H${half} ${year}`, text)}
                                onRemoveGoal={(index) => removePeriodGoal(halfKey, index, 'half_year', halfDate, `H${half} ${year}`)}
                                onEditGoal={(index, text) => saveEditPeriodGoal(halfKey, index, 'half_year', halfDate, `H${half} ${year}`, text)}
                              />
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </YearSection>
              )
            })}
          </div>
        </div>
      )}

      {/* Message Toast */}
      {message && (
        <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 border border-gray-200 z-50">
          <p className="font-medium">{message}</p>
        </div>
      )}
    </div>
  )
}
