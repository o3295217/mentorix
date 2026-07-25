'use client'

export type PlanLens = 'list' | 'timeline'

type PlanLensSwitchProps = {
  value: PlanLens
  onChange: (value: PlanLens) => void
  timelineDisabled?: boolean
  timelineBusy?: boolean
}

export default function PlanLensSwitch({ value, onChange, timelineDisabled = false, timelineBusy = false }: PlanLensSwitchProps) {
  return (
    <div className="grid grid-cols-2 rounded-xl border border-gray-700 bg-gray-950/60 p-1" role="tablist" aria-label="Линза плана">
      <button
        type="button"
        role="tab"
        aria-selected={value === 'list'}
        onClick={() => onChange('list')}
        className={`min-h-10 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${value === 'list' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-300 hover:bg-gray-800'}`}
      >
        Список
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'timeline'}
        onClick={() => onChange('timeline')}
        disabled={timelineDisabled || timelineBusy}
        className={`min-h-10 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-45 ${value === 'timeline' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-300 hover:bg-gray-800'}`}
      >
        {timelineBusy ? 'Открываю…' : 'Таймлайн'}
      </button>
    </div>
  )
}
