'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { monthNames, parseWeekKey, getPeriodKey } from '@/lib/goals-utils'
import { useGoals } from '@/hooks'
import { useGoalsChat, ParsedGoal } from '@/hooks/useGoalsChat'
import DreamBar from '@/components/goals/DreamBar'
import StrategyCards from '@/components/goals/StrategyCards'
import QuarterView from '@/components/goals/QuarterView'
import HalfYearView from '@/components/goals/HalfYearView'
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
    addPeriodGoalBatch,
    removePeriodGoal,
    editPeriodGoal,
    goals,
    processingGoals,
    setGoalPriority,
    setGoalCompleted,
    setGoalTags,
    createTrackedGoal,
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
    extractProfile,
    extractHorizon,
    extractProfileDeclined,
    startGuidedFlow,
  } = useGoalsChat(dreamGoal, yearGoals, periodGoals, selectedYear, selectedMonth, goals)

  // Вычисляемые значения — годы отсчитываются от года создания мечты, а не от текущего
  const dreamStartYear = dreamGoal ? new Date(dreamGoal.createdAt).getFullYear() : currentYear
  const dreamYearsCount = dreamGoal?.months ? Math.ceil(dreamGoal.months / 12) : 0
  const years = dreamGoal ? Array.from({ length: dreamYearsCount }, (_, i) => dreamStartYear + i) : []

  // Прогресс к мечте — из API, основан на dreamProgressScore ежедневных оценок AI
  const [dreamProgress, setDreamProgress] = useState({ total: 0, completed: 0, percent: 0 })

  useEffect(() => {
    if (!dreamGoal) return
    fetch('/api/progress')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && typeof data.progressPercent === 'number') {
          const pct = Math.round(data.progressPercent)
          setDreamProgress({
            total: data.targetDays || 1,
            completed: Math.round(data.effectiveDays || 0),
            percent: pct,
          })
        }
      })
      .catch(() => {})
  }, [dreamGoal])

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
      const allYears = Array.from({ length: dreamYearsCount }, (_, i) => currentYear + i)
      allYears.forEach(year => loadYearGoals(year))
    }
  }, [dreamGoal, currentYear, loadYearGoals])

  // Загрузка данных для выбранного года
  useEffect(() => {
    if (!dreamGoal || pageState < 2) return
    for (let h = 1; h <= 2; h++) {
      loadPeriodGoalsWithKey('half_year', new Date(selectedYear, (h - 1) * 6, 1))
    }
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

  // Wave rollover: check if approaching periods need decomposition
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

    // Проверяем текущий месяц — если нет недельных целей, предложи разбить
    const currentMonthWeekKeys = [1, 2, 3, 4, 5].map(w => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-W${w}`)
    const hasWeekGoals = currentMonthWeekKeys.some(k => (periodGoals.get(k) || []).length > 0)
    const currentMonthGoals = periodGoals.get(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`) || []

    if (currentMonthGoals.length > 0 && !hasWeekGoals) {
      return {
        month: now.getMonth(),
        year: now.getFullYear(),
        label: monthNames[now.getMonth()],
        action: 'weeks' as const,
        message: `Разбей цели ${monthNames[now.getMonth()]} по неделям`,
      }
    }

    if (nextGoals.length > 0) return null
    return {
      month: nextMonthIdx,
      year: nextYear,
      label: monthNames[nextMonthIdx],
      action: 'month' as const,
      message: `Помоги спланировать ${monthNames[nextMonthIdx]} ${nextYear}: разбей на недели с конкретными задачами.`,
    }
  }, [dreamGoal, pageState, periodGoals])

  // Принять план — разложить цели из ИИ по правильным периодам
  const handleAcceptGoals = useCallback(async (goals: ParsedGoal[]) => {
    let yearCount = 0, periodCount = 0

    // Маппинг hierarchyNumber → tracked goal ID (для установки parentId)
    const hierarchyIdMap = new Map<string, number>()

    // Определяем, есть ли иерархическая нумерация (1.1., 1.1.1.)
    const hasHierarchy = goals.some(g => g.hierarchyNumber && g.hierarchyNumber.includes('.'))

    // ===== ФАЗА 1: Группируем period goals по ключу, сохраняем batch-ом =====
    const periodBatches = new Map<string, { periodType: 'week' | 'month' | 'quarter' | 'half_year' | 'year'; date: Date; label: string; texts: string[] }>()

    for (const goal of goals) {
      if (goal.periodType === 'year') {
        const year = parseInt(goal.periodKey, 10)
        if (!isNaN(year)) {
          addYearGoal(year, goal.text)
          yearCount++
        }
        continue
      }

      let key = '', periodType: 'week' | 'month' | 'quarter' | 'half_year' | 'year' = 'week', date: Date = new Date(), label = ''

      if (goal.periodType === 'quarter') {
        const match = goal.periodKey.match(/^(\d{4})-Q([1-4])$/)
        if (!match) continue
        const y = parseInt(match[1], 10), q = parseInt(match[2], 10)
        date = new Date(y, (q - 1) * 3, 1)
        key = getPeriodKey('quarter', date)
        periodType = 'quarter'
        label = `Q${q} ${y}`
      } else if (goal.periodType === 'half_year') {
        const match = goal.periodKey.match(/^(\d{4})-H([12])$/)
        if (!match) continue
        const y = parseInt(match[1], 10), h = parseInt(match[2], 10)
        date = new Date(y, (h - 1) * 6, 1)
        key = getPeriodKey('half_year', date)
        periodType = 'half_year'
        label = `H${h} ${y}`
      } else if (goal.periodType === 'month') {
        const match = goal.periodKey.match(/^(\d{4})-(\d{2})$/)
        if (!match) continue
        const y = parseInt(match[1], 10), m = parseInt(match[2], 10) - 1
        date = new Date(y, m, 1)
        key = getPeriodKey('month', date)
        periodType = 'month'
        label = monthNames[m]
      } else if (goal.periodType === 'week') {
        const match = goal.periodKey.match(/^(\d{4})-(\d{2})-W(\d+)$/)
        if (!match) continue
        const y = parseInt(match[1], 10), m = parseInt(match[2], 10) - 1, w = parseInt(match[3], 10)
        const firstDay = new Date(y, m, 1)
        date = new Date(firstDay)
        while (date.getDay() !== 1) date.setDate(date.getDate() + 1)
        date.setDate(date.getDate() + (w - 1) * 7)
        key = `${y}-${String(m + 1).padStart(2, '0')}-W${w}`
        periodType = 'week'
        label = `Неделя ${w}`
      }

      if (!key) continue

      const batch = periodBatches.get(key)
      if (batch) {
        batch.texts.push(goal.text)
      } else {
        periodBatches.set(key, { periodType, date, label, texts: [goal.text] })
      }
      periodCount++
    }

    // Один save на каждый period key — без race condition
    for (const [key, batch] of periodBatches) {
      addPeriodGoalBatch(key, batch.periodType, batch.date, batch.label, batch.texts)
    }

    const parts: string[] = []
    if (yearCount > 0) parts.push(`${yearCount} годовых`)
    if (periodCount > 0) parts.push(`${periodCount} по периодам`)
    showMessage(`Добавлено: ${parts.join(', ')} (всего ${goals.length})`)

    // ===== ФАЗА 2: Создать tracked goals с parentId (последовательно) =====
    if (hasHierarchy) {
      for (const goal of goals) {
        if (!goal.hierarchyNumber) continue
        let periodKey = ''
        if (goal.periodType === 'year') {
          periodKey = goal.periodKey
        } else if (goal.periodType === 'half_year') {
          const match = goal.periodKey.match(/^(\d{4})-H([12])$/)
          if (match) periodKey = getPeriodKey('half_year', new Date(parseInt(match[1], 10), (parseInt(match[2], 10) - 1) * 6, 1))
        } else if (goal.periodType === 'quarter') {
          const match = goal.periodKey.match(/^(\d{4})-Q([1-4])$/)
          if (match) periodKey = getPeriodKey('quarter', new Date(parseInt(match[1], 10), (parseInt(match[2], 10) - 1) * 3, 1))
        } else if (goal.periodType === 'month') {
          const match = goal.periodKey.match(/^(\d{4})-(\d{2})$/)
          if (match) periodKey = getPeriodKey('month', new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, 1))
        } else if (goal.periodType === 'week') {
          const match = goal.periodKey.match(/^(\d{4})-(\d{2})-W(\d+)$/)
          if (match) periodKey = `${match[1]}-${match[2]}-W${match[3]}`
        }
        if (!periodKey) continue

        let parentId: number | null = null
        const parentNum = goal.hierarchyNumber.split('.').slice(0, -1).join('.')
        if (parentNum) parentId = hierarchyIdMap.get(parentNum) || null

        const tracked = await createTrackedGoal(periodKey, goal.text, 0, [], parentId)
        if (tracked) hierarchyIdMap.set(goal.hierarchyNumber, tracked.id)
      }
    }
  }, [addYearGoal, addPeriodGoalBatch, createTrackedGoal, showMessage])

  // Автосохранение профиля планирования при обнаружении маркера [PROFILE:] в последнем сообщении
  const lastSavedProfileRef = useRef('')
  const lastSavedHorizonRef = useRef(0)
  const profileDeclineSavedRef = useRef(false)
  useEffect(() => {
    if (chatLoading || chatMessages.length === 0) return
    const lastMsg = chatMessages[chatMessages.length - 1]
    if (lastMsg.role !== 'assistant') return

    // Сохранение профиля
    const profile = extractProfile(lastMsg.content)
    if (profile) {
      const profileKey = JSON.stringify(profile)
      if (profileKey !== lastSavedProfileRef.current) {
        lastSavedProfileRef.current = profileKey
        fetch('/api/goals/planning-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...profile, declined: false }),
        }).then(() => {
          showMessage('Профиль планирования сохранён')
        }).catch(() => {
          lastSavedProfileRef.current = ''
        })
      }
    }

    // Сохранение отказа от профиля
    if (!profileDeclineSavedRef.current && extractProfileDeclined(lastMsg.content)) {
      profileDeclineSavedRef.current = true
      fetch('/api/goals/planning-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ declined: true }),
      }).catch(() => {
        profileDeclineSavedRef.current = false
      })
    }

    // Сохранение горизонта
    const horizon = extractHorizon(lastMsg.content)
    if (horizon && horizon !== lastSavedHorizonRef.current && dreamGoal) {
      lastSavedHorizonRef.current = horizon
      saveDream(dreamGoal.goalText, horizon)
    }
  }, [chatMessages, chatLoading, extractProfile, extractHorizon, extractProfileDeclined, showMessage, dreamGoal, saveDream])

  return (
    <div>
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
              trackedGoals={goals}
              onAddYearGoal={addYearGoal}
              onRemoveYearGoal={removeYearGoal}
              onEditYearGoal={editYearGoal}
            />

            {/* Полугодия */}
            <HalfYearView
              year={selectedYear}
              periodGoals={periodGoals}
              trackedGoals={goals}
              currentYear={currentYear}
              onAddPeriodGoal={(key, text) => {
                const h = parseInt(key.split('-H')[1])
                const hDate = new Date(selectedYear, (h - 1) * 6, 1)
                addPeriodGoal(key, 'half_year', hDate, `H${h} ${selectedYear}`, text)
              }}
              onRemovePeriodGoal={(key, index) => {
                const h = parseInt(key.split('-H')[1])
                const hDate = new Date(selectedYear, (h - 1) * 6, 1)
                removePeriodGoal(key, index, 'half_year', hDate, `H${h} ${selectedYear}`)
              }}
              onEditPeriodGoal={(key, index, text) => {
                const h = parseInt(key.split('-H')[1])
                const hDate = new Date(selectedYear, (h - 1) * 6, 1)
                saveEditPeriodGoal(key, index, 'half_year', hDate, `H${h} ${selectedYear}`, text)
              }}
            />

            {/* Кварталы */}
            <QuarterView
              year={selectedYear}
              periodGoals={periodGoals}
              trackedGoals={goals}
              currentYear={currentYear}
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
                    {waveNudge.action === 'weeks'
                      ? <>У <strong className="text-white">{waveNudge.label}</strong> есть цели, но нет недельной разбивки.</>
                      : <>Наступает <strong className="text-white">{waveNudge.label}</strong>. Давай разобьём на недели?</>}
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
                      sendMessage(waveNudge.message)
                    }}
                    className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:from-blue-500 hover:to-blue-400"
                  >
                    Разбить на шаги
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
                // Удаляем цель из месяца (перемещение, не копирование)
                const goalIndex = monthGoals.findIndex(g => g === goal)
                if (goalIndex !== -1) {
                  removePeriodGoal(monthKey, goalIndex, 'month', monthDate, monthNames[selectedMonth])
                }
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
