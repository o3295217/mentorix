'use client'

import { PlanListIcon, PlanTimelineIcon } from '@/components/icons'

export type PlanLens = 'list' | 'timeline'

type PlanLensSwitchProps = {
  value: PlanLens
  onChange: (value: PlanLens) => void
  timelineDisabled?: boolean
  timelineBusy?: boolean
}

export default function PlanLensSwitch({ value, onChange, timelineDisabled = false, timelineBusy = false }: PlanLensSwitchProps) {
  const listActive = value === 'list'
  const timelineActive = value === 'timeline'
  const timelineLabel = timelineBusy ? 'Открываю таймлайн' : 'Таймлайн'

  return (
    <div className="flex items-center gap-1" role="tablist" aria-label="Линза плана">
      <button
        type="button"
        role="tab"
        aria-selected={listActive}
        aria-label="Список"
        title="Список"
        onClick={() => onChange('list')}
        className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${listActive ? 'bg-blue-500/15 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-blue-400'}`}
      >
        <PlanListIcon className="h-[18px] w-[18px]" />
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={timelineActive}
        aria-label={timelineLabel}
        title={timelineLabel}
        onClick={() => onChange('timeline')}
        disabled={timelineDisabled || timelineBusy}
        className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-45 ${timelineActive ? 'bg-blue-500/15 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-blue-400'}`}
      >
        <PlanTimelineIcon className={`h-[18px] w-[18px] ${timelineBusy ? 'animate-pulse' : ''}`} />
      </button>
    </div>
  )
}
