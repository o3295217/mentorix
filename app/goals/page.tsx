'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { monthNames, parseWeekKey } from '@/lib/goals-utils'
import { useGoals } from '@/hooks'
import { useGoalsChat } from '@/hooks/useGoalsChat'
import DreamBar from '@/components/goals/DreamBar'
import HorizonsCard from '@/components/goals/HorizonsCard'
import StrategyCards from '@/components/goals/StrategyCards'
import QuarterView from '@/components/goals/QuarterView'
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

  // Вычисляемые значения — годы отсчитываются от года создания мечты, а не от текущего
  const dreamStartYear = dreamGoal ? new Date(dreamGoal.createdAt).getFullYear() : currentYear
  const years = dreamGoal ? Array.from({ length: dreamGoal.years }, (_, i) => dreamStartYear + i) : []

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
            {/* Горизонты планирования */}
            {dreamGoal && (
              <HorizonsCard
                dreamYears={dreamGoal.years}
                currentYear={currentYear}
                periodGoals={periodGoals}
                yearGoals={yearGoals}
                selectedYear={selectedYear}
              />
            )}

            {/* Карточки по годам */}
            <StrategyCards
              years={years}
              selectedYear={selectedYear}
              onSelectYear={setSelectedYear}
              currentYear={currentYear}
              yearGoals={yearGoals}
              periodGoals={periodGoals}
              trackedGoals={goals}
              onAddYearGoal={addYearGoal}
              onRemoveYearGoal={removeYearGoal}
              onEditYearGoal={editYearGoal}
            />

            {/* Кварталы */}
            <QuarterView
              year={selectedYear}
              periodGoals={periodGoals}
              trackedGoals={goals}
              onAddPeriodGoal={(key, text) => {
                const q = parseInt(key.split('-Q')[1])
                const qDate = new Date(selectedYear, (q - 1) * 3, 1)
                addPeriodGoal(key, 'quarter', qDate, `Q${q}`, text)
              }}
              onRemovePeriodGoal={(key, index) => {
                const q = parseInt(key.split('-Q')[1])
                const qDate = new Date(selectedYear, (q - 1) * 3, 1)
                removePeriodGoal(key, index, 'quarter', qDate, `Q${q}`)
              }}
              onEditPeriodGoal={(key, index, text) => {
                const q = parseInt(key.split('-Q')[1])
                const qDate = new Date(selectedYear, (q - 1) * 3, 1)
                editPeriodGoal(key, index, 'quarter', qDate, `Q${q}`, text)
              }}
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
              tags={tags}
            />

            {/* Wave rollover nudge */}
            {waveNudge && (
              <div className="relative overflow-hidden rounded-[28px] border border-amber-500/30 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.08),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10">
                    <svg className="h-5 w-5 text-amber-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-200">
                    Наступает <strong className="text-white">{waveNudge.label}</strong>. Давай разобьём на недели?
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedYear(waveNudge.year)
                      setSelectedMonth(waveNudge.month)
                    }}
                    className="inline-flex items-center rounded-full border border-slate-600 bg-slate-900/80 px-4 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
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
                    className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:from-blue-500 hover:to-blue-400"
                  >
                    ИОН разобьёт
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
        <div className="fixed bottom-4 right-4 rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-sm shadow-[0_18px_60px_rgba(2,6,23,0.40)] p-4 z-50">
          <p className="text-sm font-medium text-white">{message}</p>
        </div>
      )}
    </div>
  )
}
