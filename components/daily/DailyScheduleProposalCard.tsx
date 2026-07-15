'use client'

import { useMemo, useState } from 'react'
import type { DailyScheduleProposalMetadata } from '@/lib/daily-schedule-proposal'
import { formatDurationLabel, minutesToTimeLabel } from '@/hooks/daily/schedule-helpers'
import { buildProposalApplyOptions, proposalHasExistingSchedule, type ProposalApplyOptions } from '@/hooks/daily/proposal-helpers'

export interface DailyScheduleProposalCardProps {
  metadata: DailyScheduleProposalMetadata
  messageId?: string
  isApplying: boolean
  onApply: (options: ProposalApplyOptions) => Promise<void>
}

const kindLabel = { task: 'задача', meal: 'еда', rest: 'отдых', buffer: 'буфер' } as const
const kindClass = {
  task: 'border-blue-400/50 bg-blue-500/15 text-blue-100',
  meal: 'border-orange-400/50 bg-orange-500/15 text-orange-100',
  rest: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100',
  buffer: 'border-purple-400/50 bg-purple-500/15 text-purple-100',
} as const

export default function DailyScheduleProposalCard({
  metadata,
  messageId,
  isApplying,
  onApply,
}: DailyScheduleProposalCardProps) {
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [error, setError] = useState('')
  const hasExistingSchedule = proposalHasExistingSchedule(metadata)
  const isApplied = Boolean(metadata.appliedAt)
  const blocks = useMemo(
    () => [...metadata.proposal.blocks].sort((a, b) => a.startMinutes - b.startMinutes),
    [metadata.proposal.blocks],
  )

  const handleClick = async () => {
    if (!messageId || isApplying || isApplied) return
    setError('')
    if (hasExistingSchedule && !confirmReplace) {
      setConfirmReplace(true)
      return
    }
    try {
      await onApply(buildProposalApplyOptions(metadata))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось применить расписание')
    }
  }

  return (
    <section className="mt-3 max-w-xl rounded-2xl border border-blue-500/30 bg-gradient-to-br from-gray-900 to-gray-950 p-3 shadow-lg shadow-blue-950/20" aria-label="Предложение расписания">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-100">Согласованный график дня</h3>
          <p className="text-xs text-gray-400">
            {minutesToTimeLabel(metadata.proposal.dayStartMinutes)}–{minutesToTimeLabel(metadata.proposal.dayEndMinutes)} · {blocks.length} блоков
          </p>
        </div>
        {isApplied && (
          <span className="rounded-full border border-green-500/40 bg-green-500/10 px-2 py-1 text-xs font-medium text-green-300" role="status">
            Размещено
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {blocks.map((block, index) => {
          const title = block.kind === 'task' ? block.taskText : block.title
          return (
            <div key={`${block.kind}-${block.startMinutes}-${index}`} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${kindClass[block.kind]}`}>
              <div className="w-24 shrink-0 text-xs font-medium">
                {minutesToTimeLabel(block.startMinutes)}–{minutesToTimeLabel(block.startMinutes + block.durationMinutes)}
              </div>
              <div className="min-w-0 flex-1 truncate text-sm">{title}</div>
              <div className="hidden shrink-0 text-xs opacity-80 sm:block">{kindLabel[block.kind]} · {formatDurationLabel(block.durationMinutes)}</div>
            </div>
          )
        })}
      </div>

      {metadata.proposal.rationale && (
        <p className="mt-2 text-xs leading-5 text-gray-400">{metadata.proposal.rationale}</p>
      )}

      {error && <p className="mt-2 text-sm text-red-300" role="alert">{error}</p>}
      {hasExistingSchedule && confirmReplace && !isApplied && (
        <p className="mt-2 text-xs text-amber-300" role="status">
          Уже есть расписание на этот день. Нажмите ещё раз, чтобы заменить его этим вариантом.
        </p>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={!messageId || isApplying || isApplied}
        className="mt-3 w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
        aria-disabled={!messageId || isApplying || isApplied}
      >
        {isApplied ? 'Размещено' : isApplying ? 'Применяем…' : hasExistingSchedule ? 'Заменить расписание' : 'Разместить на шкале'}
      </button>
      {!messageId && <p className="mt-1 text-xs text-gray-500">Кнопка станет доступна после сохранения ответа ассистента.</p>}
    </section>
  )
}
