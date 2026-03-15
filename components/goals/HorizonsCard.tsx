'use client'

interface HorizonsCardProps {
  dreamYears: number
  currentYear: number
  periodGoals: Map<string, string[]>
  yearGoals: Map<number, string[]>
  selectedYear: number
}

export default function HorizonsCard({
  dreamYears,
  currentYear,
  periodGoals,
  yearGoals,
  selectedYear,
}: HorizonsCardProps) {
  const now = new Date()
  const currentMonth = now.getMonth()

  // Детально: ближайшие 3 месяца — считаем недельные + месячные цели
  const detailMonths = [0, 1, 2].map(offset => {
    const m = (currentMonth + offset) % 12
    const y = currentMonth + offset > 11 ? currentYear + 1 : currentYear
    return { month: m, year: y }
  })

  const detailGoals = detailMonths.reduce((sum, { month, year }) => {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
    const monthGoals = periodGoals.get(monthKey) || []
    // Count week goals for this month too
    let weekCount = 0
    for (let w = 1; w <= 5; w++) {
      const weekKey = `${year}-${String(month + 1).padStart(2, '0')}-W${w}`
      weekCount += (periodGoals.get(weekKey) || []).length
    }
    return sum + monthGoals.length + weekCount
  }, 0)

  // Укрупнённо: 3–12 месяцев — квартальные + месячные цели (кроме ближайших 3)
  const midGoals = (() => {
    let count = 0
    for (let offset = 3; offset < 12; offset++) {
      const m = (currentMonth + offset) % 12
      const y = currentMonth + offset > 11 ? currentYear + 1 : currentYear
      const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`
      count += (periodGoals.get(monthKey) || []).length
    }
    // Quarters for selected year
    for (let q = 1; q <= 4; q++) {
      const qKey = `${selectedYear}-Q${q}`
      count += (periodGoals.get(qKey) || []).length
    }
    return count
  })()

  // Направление: 1+ лет — годовые цели
  const directionGoals = Array.from(yearGoals.values()).reduce((sum, g) => sum + g.length, 0)

  // Dots: 5 dots max, filled based on count
  const dots = (count: number, max: number) => {
    const filled = Math.min(5, Math.ceil((count / Math.max(max, 1)) * 5))
    return Array.from({ length: 5 }, (_, i) => i < filled)
  }

  const horizons = [
    {
      label: 'ДЕТАЛЬНО',
      period: 'Ближайшие 3 месяца',
      desc: 'Задачи по неделям, конкретные шаги',
      count: detailGoals,
      dots: dots(detailGoals, 40),
      active: true,
      color: 'blue',
    },
    {
      label: 'УКРУПНЁННО',
      period: '3–12 месяцев',
      desc: 'Блоки задач, промежуточные цели',
      count: midGoals,
      dots: dots(midGoals, 30),
      active: false,
      color: 'slate',
    },
    {
      label: 'НАПРАВЛЕНИЕ',
      period: dreamYears > 1 ? `1–${dreamYears} ${dreamYears < 5 ? 'года' : 'лет'}` : '1 год',
      desc: 'Только цели и контрольные точки',
      count: directionGoals,
      dots: dots(directionGoals, 25),
      active: false,
      color: 'slate',
    },
  ]

  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500 mb-3">
        Горизонты планирования
      </div>
      <div className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] shadow-[0_18px_60px_rgba(2,6,23,0.28)]">
        <div className="grid grid-cols-1 sm:grid-cols-3">
          {horizons.map((h, i) => (
            <div
              key={h.label}
              className={`p-5 ${
                i === 0
                  ? 'bg-blue-500/10 border-b sm:border-b-0 border-slate-700/50'
                  : i === 1
                    ? 'bg-slate-800/40 border-b sm:border-b-0 sm:border-l border-slate-700/50'
                    : 'bg-slate-900/30 sm:border-l border-slate-700/50'
              }`}
            >
              <div className={`text-xs font-bold tracking-wide ${i === 0 ? 'text-blue-400' : 'text-slate-400'}`}>
                {h.label}
              </div>
              <div className="text-lg font-semibold tracking-tight mt-1 text-white">
                {h.period}
              </div>
              <div className="text-sm mt-1 leading-relaxed text-slate-500">
                {h.desc}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <div className="flex gap-1">
                  {h.dots.map((filled, j) => (
                    <div
                      key={j}
                      className={`w-2 h-2 rounded-full ${filled ? 'bg-blue-400' : 'bg-slate-700'}`}
                    />
                  ))}
                </div>
                {h.count > 0 && (
                  <span className="text-xs text-slate-500 tabular-nums">{h.count}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
