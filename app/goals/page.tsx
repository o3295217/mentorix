'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { monthNames, parseWeekKey } from '@/lib/goals-utils'
import { useGoals } from '@/hooks'
import { useGoalsChat } from '@/hooks/useGoalsChat'
import DreamBar from '@/components/goals/DreamBar'
import StrategyCards from '@/components/goals/StrategyCards'
import MonthTimeline from '@/components/goals/MonthTimeline'
import MonthSection from '@/components/goals/MonthSection'
import GoalsChatTrigger from '@/components/goals/GoalsChatTrigger'
import GoalsChatPanel from '@/components/goals/GoalsChatPanel'

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
    setGoalTags,
    tags,
    createTag: createTagApi,
    calculatePeriodProgress,
    showMessage,
    message,
    currentYear,
  } = useGoals()

  // Навигация
  const currentMonth = new Date().getMonth()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [chatOpen, setChatOpen] = useState(false)
  const [setupComplete, setSetupComplete] = useState(false)

  // UI-состояния для недель
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set())
  const [draggedGoal, setDraggedGoal] = useState<{ weekKey: string; index: number; goal: string } | null>(null)
  const [dragOverWeek, setDragOverWeek] = useState<string | null>(null)

  // Фильтры (пока статические, TODO: добавить UI фильтрации)
  const searchQuery = ''
  const filterStatus: 'all' | 'active' | 'completed' = 'all'
  const filterPriority: number | null = null
  const filterTag: string | null = null

  // Чат с ИИ
  const {
    messages: chatMessages,
    sendMessage,
    isLoading: chatLoading,
    contextLabel,
    extractGoals,
    startGuidedFlow,
  } = useGoalsChat(dreamGoal, yearGoals, periodGoals, selectedYear, selectedMonth)

  // Вычисляемые значения
  const years = dreamGoal ? Array.from({ length: dreamGoal.years }, (_, i) => currentYear + i) : []

  const dreamProgress = useMemo(() => {
    const total = goals.length
    const completed = goals.filter(g => g.completed).length
    return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }, [goals])

  // Определение: есть ли уже заполненные цели?
  const hasAnyGoals = useMemo(() => {
    const hasYearGoals = Array.from(yearGoals.values()).some(g => g.length > 0)
    const hasPeriodGoals = Array.from(periodGoals.values()).some(g => g.length > 0)
    return hasYearGoals || hasPeriodGoals
  }, [yearGoals, periodGoals])

  useEffect(() => {
    if (hasAnyGoals) setSetupComplete(true)
  }, [hasAnyGoals])

  // Состояние страницы: 0=нет мечты, 1=мечта без целей, 2=полная карта
  const pageState = !dreamGoal ? 0 : !setupComplete ? 1 : 2

  // Загрузка годовых целей
  useEffect(() => {
    if (dreamGoal) {
      const allYears = Array.from({ length: dreamGoal.years }, (_, i) => currentYear + i)
      allYears.forEach(year => loadYearGoals(year))
    }
  }, [dreamGoal, currentYear, loadYearGoals])

  // Загрузка данных для выбранного года
  useEffect(() => {
    if (!dreamGoal || pageState < 2) return
    for (let q = 1; q <= 4; q++) {
      loadPeriodGoalsWithKey('quarter', new Date(selectedYear, (q - 1) * 3, 1))
    }
    for (let m = 0; m < 12; m++) {
      loadPeriodGoalsWithKey('month', new Date(selectedYear, m, 1))
    }
  }, [selectedYear, dreamGoal, pageState, loadPeriodGoalsWithKey])

  // Загрузка недель для выбранного месяца
  useEffect(() => {
    if (!dreamGoal || pageState < 2) return
    loadAllWeeksForMonth(selectedYear, selectedMonth)
  }, [selectedYear, selectedMonth, dreamGoal, pageState, loadAllWeeksForMonth])

  // Горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && chatOpen) setChatOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [chatOpen])

  // Хелперы для работы с задачами
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

  // Данные текущего месяца
  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
  const monthGoals = periodGoals.get(monthKey) || []
  const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth
  const monthProgress = calculatePeriodProgress(monthKey)
  const monthDate = new Date(selectedYear, selectedMonth, 1)

  // Wave rollover: check if next month is approaching and has no goals
  const waveNudge = useMemo(() => {
    if (!dreamGoal || pageState < 2) return null
    const now = new Date()
    const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()
    if (daysLeft > 7) return null // only nudge in the last 7 days of the month
    const nextMonth = now.getMonth() + 1
    const nextYear = nextMonth > 11 ? now.getFullYear() + 1 : now.getFullYear()
    const nextMonthIdx = nextMonth > 11 ? 0 : nextMonth
    const nextMonthKey = `${nextYear}-${String(nextMonthIdx + 1).padStart(2, '0')}`
    const nextGoals = periodGoals.get(nextMonthKey) || []
    if (nextGoals.length > 0) return null
    return { month: nextMonthIdx, year: nextYear, label: monthNames[nextMonthIdx] }
  }, [dreamGoal, pageState, periodGoals])

  // Принять план — добавить цели из ИИ в текущий период
  const handleAcceptGoals = useCallback((goals: string[]) => {
    for (const goalText of goals) {
      addPeriodGoal(monthKey, 'month', monthDate, monthNames[selectedMonth], goalText)
    }
    showMessage(`Добавлено ${goals.length} целей в ${monthNames[selectedMonth]}`)
  }, [monthKey, monthDate, selectedMonth, addPeriodGoal, showMessage])

  return (
    <div className={`transition-all duration-300 ${chatOpen ? 'mr-[400px] max-md:mr-0' : ''}`}>
      <div className="space-y-4">
        {/* DreamBar — управляет состояниями 0, 1, 2 */}
        <DreamBar
          dreamGoal={dreamGoal}
          onSave={saveDream}
          progress={dreamProgress}
          isSetup={pageState === 1}
          onSetupComplete={() => setSetupComplete(true)}
          onOpenChat={() => {
            setChatOpen(true)
            startGuidedFlow()
          }}
        />

        {/* Состояние 2: Полная карта планирования */}
        {pageState === 2 && (
          <>
            {/* Карточки по годам */}
            <StrategyCards
              years={years}
              selectedYear={selectedYear}
              onSelectYear={setSelectedYear}
              currentYear={currentYear}
              yearGoals={yearGoals}
              periodGoals={periodGoals}
              onAddYearGoal={addYearGoal}
              onRemoveYearGoal={removeYearGoal}
              onEditYearGoal={editYearGoal}
            />

            {/* Шкала 12 месяцев */}
            <MonthTimeline
              year={selectedYear}
              selectedMonth={selectedMonth}
              onSelectMonth={setSelectedMonth}
              currentYear={currentYear}
              currentMonth={currentMonth}
              periodGoals={periodGoals}
              calculatePeriodProgress={calculatePeriodProgress}
            />

            {/* Wave rollover nudge */}
            {waveNudge && (
              <div className="card border border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📅</span>
                  <p className="text-sm text-gray-200">
                    Наступает <strong>{waveNudge.label}</strong>. Давай разобьём на недели?
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedYear(waveNudge.year)
                      setSelectedMonth(waveNudge.month)
                    }}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    Перейти
                  </button>
                  <button
                    onClick={() => {
                      setSelectedYear(waveNudge.year)
                      setSelectedMonth(waveNudge.month)
                      setChatOpen(true)
                      sendMessage(`Помоги спланировать ${waveNudge.label} ${waveNudge.year}: разбей на недели с конкретными задачами.`)
                    }}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    ИИ разобьёт
                  </button>
                </div>
              </div>
            )}

            {/* Детализация выбранного месяца */}
            <MonthSection
              month={selectedMonth}
              year={selectedYear}
              goals={monthGoals}
              isCurrent={isCurrentMonth}
              progress={monthProgress}
              onAddGoal={(text) => addPeriodGoal(monthKey, 'month', monthDate, monthNames[selectedMonth], text)}
              onRemoveGoal={(index) => removePeriodGoal(monthKey, index, 'month', monthDate, monthNames[selectedMonth])}
              onEditGoal={(index, text) => saveEditPeriodGoal(monthKey, index, 'month', monthDate, monthNames[selectedMonth], text)}
              periodGoals={periodGoals}
              trackedGoals={goals}
              onCopyGoal={(goal, _targetType, targetKey) => {
                const parsed = parseWeekKey(targetKey)
                addPeriodGoal(targetKey, 'week', parsed.weekStart, `Неделя ${parsed.weekNum}`, goal)
              }}
              draggedGoal={draggedGoal}
              setDraggedGoal={setDraggedGoal}
              dragOverWeek={dragOverWeek}
              setDragOverWeek={setDragOverWeek}
              onMoveGoal={moveGoalBetweenWeeks}
              onAddWeekGoal={(weekKey, text, goalTags) => {
                const parsed = parseWeekKey(weekKey)
                addPeriodGoal(weekKey, 'week', parsed.weekStart, `Неделя ${parsed.weekNum}`, text)
                if (goalTags && goalTags.length > 0) {
                  setGoalTags(weekKey, text, goalTags)
                }
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
              tags={tags}
              onCreateTag={createTagApi}
              onSetGoalTags={setGoalTags}
              searchQuery={searchQuery}
              filterStatus={filterStatus}
              filterPriority={filterPriority}
              filterTag={filterTag}
            />
          </>
        )}
      </div>

      {/* Кнопка ИИ-помощника */}
      {dreamGoal && !chatOpen && (
        <GoalsChatTrigger onClick={() => setChatOpen(true)} />
      )}

      {/* Панель ИИ-чата */}
      <GoalsChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMessages}
        onSendMessage={sendMessage}
        isLoading={chatLoading}
        contextLabel={contextLabel}
        extractGoals={extractGoals}
        onAcceptGoals={handleAcceptGoals}
      />

      {/* Toast */}
      {message && (
        <div className="fixed bottom-4 right-4 bg-gray-900/80 shadow-lg rounded-lg p-4 border border-gray-700 z-50">
          <p className="font-medium text-white">{message}</p>
        </div>
      )}
    </div>
  )
}
