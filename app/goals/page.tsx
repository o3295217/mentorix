'use client'

import { useState, useEffect, useMemo } from 'react'
import { getDetailLevel } from '@/lib/dates'
import { monthNames, parseWeekKey } from '@/lib/goals-utils'
import { useGoals, useGoalsCopy } from '@/hooks'
import DreamSection from '@/components/goals/DreamSection'
import YearSection from '@/components/goals/YearSection'
import QuarterSection from '@/components/goals/QuarterSection'
import MonthSection from '@/components/goals/MonthSection'
import HalfYearSection from '@/components/goals/HalfYearSection'
import TimelineNav from '@/components/goals/TimelineNav'

export default function GoalsPage() {
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

  // Навигация по времени
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter)

  // UI-состояния для недель
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set())
  const [draggedGoal, setDraggedGoal] = useState<{ weekKey: string; index: number; goal: string } | null>(null)
  const [dragOverWeek, setDragOverWeek] = useState<string | null>(null)

  // Фильтры и поиск
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all')
  const [filterPriority, setFilterPriority] = useState<number | null>(null)
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

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
        showMessage('Горячие клавиши: Esc=отмена, Ctrl+F=поиск, Enter=сохранить')
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

  // Вычисляемые значения
  const years = dreamGoal ? Array.from({ length: dreamGoal.years }, (_, i) => currentYear + i) : []
  const detailLevel = getDetailLevel(selectedYear, currentYear)

  // Прогресс мечты — по всем трекинговым целям
  const dreamProgress = useMemo(() => {
    const total = goals.length
    const completed = goals.filter(g => g.completed).length
    return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }, [goals])

  // Загрузка годовых целей при появлении dreamGoal
  useEffect(() => {
    if (dreamGoal) {
      const allYears = Array.from({ length: dreamGoal.years }, (_, i) => currentYear + i)
      allYears.forEach(year => loadYearGoals(year))
    }
  }, [dreamGoal, currentYear, loadYearGoals])

  // Загрузка данных при смене выбранного года
  useEffect(() => {
    if (!dreamGoal) return
    const dl = getDetailLevel(selectedYear, currentYear)
    if (dl === 'month' || dl === 'quarter') {
      for (let q = 1; q <= 4; q++) {
        loadPeriodGoalsWithKey('quarter', new Date(selectedYear, (q - 1) * 3, 1))
      }
    }
    if (dl === 'month') {
      for (let m = 0; m < 12; m++) {
        loadPeriodGoalsWithKey('month', new Date(selectedYear, m, 1))
      }
    }
    if (dl === 'half') {
      loadPeriodGoalsWithKey('half_year', new Date(selectedYear, 0, 1))
      loadPeriodGoalsWithKey('half_year', new Date(selectedYear, 6, 1))
    }
  }, [selectedYear, dreamGoal, currentYear, loadPeriodGoalsWithKey])

  // Загрузка недель при смене квартала (только для month detailLevel)
  useEffect(() => {
    if (!dreamGoal || detailLevel !== 'month') return
    const startMonth = (selectedQuarter - 1) * 3
    for (let i = 0; i < 3; i++) {
      loadAllWeeksForMonth(selectedYear, startMonth + i)
    }
  }, [selectedYear, selectedQuarter, dreamGoal, detailLevel, loadAllWeeksForMonth])

  // Перемещение задачи между неделями (drag-and-drop)
  const moveGoalBetweenWeeks = (fromWeekKey: string, toWeekKey: string, goalIndex: number, goalText: string) => {
    if (fromWeekKey === toWeekKey) return
    const fromParsed = parseWeekKey(fromWeekKey)
    const toParsed = parseWeekKey(toWeekKey)
    removePeriodGoal(fromWeekKey, goalIndex, 'week', fromParsed.weekStart, `Неделя ${fromParsed.weekNum}`)
    addPeriodGoal(toWeekKey, 'week', toParsed.weekStart, `Неделя ${toParsed.weekNum}`, goalText)
    showMessage(`Задача перемещена в W${toParsed.weekNum}`)
  }

  const saveEditPeriodGoal = (periodKey: string, index: number, periodType: 'quarter' | 'month' | 'week' | 'half_year', date: Date, label: string, text: string) => {
    editPeriodGoal(periodKey, index, periodType, date, label, text)
  }

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

  const hasActiveFilters = searchQuery || filterStatus !== 'all' || filterPriority !== null || filterTag !== null

  return (
    <div className="space-y-5">
      {/* Заголовок + компактный тулбар */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Цели</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
              showFilters || hasActiveFilters
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-transparent'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Фильтры
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            )}
          </button>
        </div>
      </div>

      {/* Раскрывающаяся панель фильтров */}
      {showFilters && (
        <div className="card bg-gray-900/60 border border-gray-800 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск целей..."
                className="w-full px-3 py-1.5 text-sm border border-gray-700 rounded-lg bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'completed')}
              className="px-2.5 py-1.5 text-sm border border-gray-700 rounded-lg bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            >
              <option value="all">Все статусы</option>
              <option value="active">Активные</option>
              <option value="completed">Выполненные</option>
            </select>
            <select
              value={filterPriority ?? ''}
              onChange={(e) => setFilterPriority(e.target.value ? parseInt(e.target.value) : null)}
              className="px-2.5 py-1.5 text-sm border border-gray-700 rounded-lg bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            >
              <option value="">Все приоритеты</option>
              <option value="3">Высокий</option>
              <option value="2">Средний</option>
              <option value="1">Низкий</option>
              <option value="0">Без приоритета</option>
            </select>
            <select
              value={filterTag ?? ''}
              onChange={(e) => setFilterTag(e.target.value || null)}
              className="px-2.5 py-1.5 text-sm border border-gray-700 rounded-lg bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            >
              <option value="">Все теги</option>
              {(tags || []).map(tag => (
                <option key={tag.id} value={tag.name}>{tag.name}</option>
              ))}
            </select>
            {hasActiveFilters && (
              <button
                onClick={() => { setSearchQuery(''); setFilterStatus('all'); setFilterPriority(null); setFilterTag(null) }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Сбросить
              </button>
            )}
          </div>

          {/* Теги — компактная строка */}
          <div className="mt-3 pt-3 border-t border-gray-800">
            <div className="flex flex-wrap gap-1.5 items-center">
              {(tags || []).map(tag => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                  style={{ backgroundColor: tag.color + '15', color: tag.color, border: `1px solid ${tag.color}40` }}
                >
                  {tag.name}
                  <button onClick={() => deleteTag(tag.id)} className="hover:opacity-70 ml-0.5">×</button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                  placeholder="+ тег"
                  className="px-2 py-0.5 text-xs border border-gray-700 rounded-lg w-20 bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-gray-600"
                />
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0"
                />
                {newTagName.trim() && (
                  <button
                    onClick={handleCreateTag}
                    className="px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Секция Мечты */}
      <DreamSection
        dreamGoal={dreamGoal}
        onSave={saveDream}
        progress={dreamProgress}
      />

      {/* Навигация + контент */}
      {dreamGoal && (
        <>
          <TimelineNav
            years={years}
            selectedYear={selectedYear}
            selectedQuarter={selectedQuarter}
            currentYear={currentYear}
            currentQuarter={currentQuarter}
            onSelectYear={setSelectedYear}
            onSelectQuarter={setSelectedQuarter}
          />

          <div className="space-y-4">
            {/* Цели года */}
            <YearSection
              year={selectedYear}
              currentYear={currentYear}
              goals={yearGoals.get(selectedYear) || []}
              onAddGoal={(text) => addYearGoal(selectedYear, text)}
              onRemoveGoal={(index) => removeYearGoal(selectedYear, index)}
              onEditGoal={(index, text) => editYearGoal(selectedYear, index, text)}
              periodGoals={periodGoals}
              onCopyGoal={handleCopyGoal}
              searchQuery={searchQuery}
            />

            {/* Квартал — для month и quarter detail levels */}
            {(detailLevel === 'month' || detailLevel === 'quarter') && (() => {
              const quarterKey = `${selectedYear}-Q${selectedQuarter}`
              const quarterGoals = periodGoals.get(quarterKey) || []
              const isCurrentQuarter = selectedYear === currentYear && selectedQuarter === currentQuarter
              const progress = calculatePeriodProgress(quarterKey)
              const quarterDate = new Date(selectedYear, (selectedQuarter - 1) * 3, 1)

              return (
                <QuarterSection
                  quarter={selectedQuarter}
                  year={selectedYear}
                  goals={quarterGoals}
                  isCurrent={isCurrentQuarter}
                  progress={progress}
                  onAddGoal={(text) => addPeriodGoal(quarterKey, 'quarter', quarterDate, `Q${selectedQuarter} ${selectedYear}`, text)}
                  onRemoveGoal={(index) => removePeriodGoal(quarterKey, index, 'quarter', quarterDate, `Q${selectedQuarter} ${selectedYear}`)}
                  onEditGoal={(index, text) => editPeriodGoal(quarterKey, index, 'quarter', quarterDate, `Q${selectedQuarter} ${selectedYear}`, text)}
                  onCopyGoal={handleCopyGoal}
                  periodGoals={periodGoals}
                  searchQuery={searchQuery}
                />
              )
            })()}

            {/* Месяцы — только для month detail level */}
            {detailLevel === 'month' && (
              <div className="space-y-3">
                {[0, 1, 2].map(offset => {
                  const month = (selectedQuarter - 1) * 3 + offset
                  const monthDate = new Date(selectedYear, month, 1)
                  const monthKey = `${selectedYear}-${String(month + 1).padStart(2, '0')}`
                  const monthGoals = periodGoals.get(monthKey) || []
                  const isCurrentMonth = selectedYear === currentYear && month === new Date().getMonth()
                  const monthProgress = calculatePeriodProgress(monthKey)

                  return (
                    <MonthSection
                      key={monthKey}
                      month={month}
                      year={selectedYear}
                      goals={monthGoals}
                      isCurrent={isCurrentMonth}
                      progress={monthProgress}
                      onAddGoal={(text) => addPeriodGoal(monthKey, 'month', monthDate, monthNames[month], text)}
                      onRemoveGoal={(index) => removePeriodGoal(monthKey, index, 'month', monthDate, monthNames[month])}
                      onEditGoal={(index, text) => saveEditPeriodGoal(monthKey, index, 'month', monthDate, monthNames[month], text)}
                      periodGoals={periodGoals}
                      trackedGoals={goals}
                      onCopyGoal={(goal, _targetType, targetKey) => {
                        const parsed = parseWeekKey(targetKey)
                        addPeriodGoal(targetKey, 'week', parsed.weekStart, `Неделя ${parsed.weekNum}`, goal)
                      }}
                      showAllPeriods={true}
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
                      searchQuery={searchQuery}
                      filterStatus={filterStatus}
                      filterPriority={filterPriority}
                      filterTag={filterTag}
                    />
                  )
                })}
              </div>
            )}

            {/* Полугодия — для half detail level */}
            {detailLevel === 'half' && (
              <div className="space-y-3">
                {[1, 2].map(half => {
                  const halfKey = `${selectedYear}-H${half}`
                  const halfGoals = periodGoals.get(halfKey) || []
                  const halfDate = new Date(selectedYear, (half - 1) * 6, 1)

                  return (
                    <HalfYearSection
                      key={halfKey}
                      half={half}
                      year={selectedYear}
                      goals={halfGoals}
                      onAddGoal={(text) => addPeriodGoal(halfKey, 'half_year', halfDate, `H${half} ${selectedYear}`, text)}
                      onRemoveGoal={(index) => removePeriodGoal(halfKey, index, 'half_year', halfDate, `H${half} ${selectedYear}`)}
                      onEditGoal={(index, text) => saveEditPeriodGoal(halfKey, index, 'half_year', halfDate, `H${half} ${selectedYear}`, text)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Подсказка если нет мечты */}
      {!dreamGoal && (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">Создайте мечту, чтобы начать планирование</p>
        </div>
      )}

      {/* Message Toast */}
      {message && (
        <div className="fixed bottom-4 right-4 bg-gray-900/80 shadow-lg rounded-lg p-4 border border-gray-700 z-50">
          <p className="font-medium text-white">{message}</p>
        </div>
      )}
    </div>
  )
}
