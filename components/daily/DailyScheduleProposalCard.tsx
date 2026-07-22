'use client'

import { useMemo, useState } from 'react'
import type { DailyScheduleProposalMetadata } from '@/lib/daily-schedule-proposal'
import { formatDurationLabel, minutesToTimeLabel } from '@/hooks/daily/schedule-helpers'
import { buildProposalApplyOptions, getProposalLoadSummary, proposalHasExistingSchedule, type ProposalApplyOptions } from '@/hooks/daily/proposal-helpers'

export interface DailyScheduleProposalCardProps {
  metadata: DailyScheduleProposalMetadata
  messageId?: string
  isApplying: boolean
  onApply: (options: ProposalApplyOptions) => Promise<void>
  onDiscuss: () => void
  onDismiss: () => void
}

const kindLabel = { task: 'задача', meal: 'еда', rest: 'отдых', buffer: 'буфер' } as const
const categoryLabel = { main: 'главное', operational: 'операц.', travel: 'дорога', personal: 'личное', meal: 'еда', rest: 'отдых', buffer: 'буфер' } as const
const kindClass = {
  task: 'border-blue-400/50 bg-blue-500/15 text-blue-100',
  meal: 'border-orange-400/50 bg-orange-500/15 text-orange-100',
  rest: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100',
  buffer: 'border-purple-400/50 bg-purple-500/15 text-purple-100',
} as const

type ProposalBlock = DailyScheduleProposalMetadata['proposal']['blocks'][number]

export function isProposalBlockFixed(block: ProposalBlock): boolean {
  return 'isFixed' in block && block.isFixed === true
}

export function getProposalBoundaryText(metadata: DailyScheduleProposalMetadata): string {
  return `старт ${minutesToTimeLabel(metadata.proposal.version === 2 ? metadata.proposal.planningStartMinutes : metadata.proposal.dayStartMinutes)} · работа до ${minutesToTimeLabel(metadata.proposal.version === 2 ? metadata.proposal.workEndMinutes : metadata.proposal.dayEndMinutes)} · активность до ${minutesToTimeLabel(metadata.proposal.version === 2 ? metadata.proposal.activityEndMinutes : metadata.proposal.dayEndMinutes)}`
}

export function getProposalBlockMetaLabel(block: ProposalBlock): string {
  const fixed = isProposalBlockFixed(block)
  const primaryLabel = 'category' in block ? categoryLabel[block.category] : kindLabel[block.kind]
  return `${primaryLabel} · ${formatDurationLabel(block.durationMinutes)}${fixed ? ' · фиксированное время' : ''}`
}

export function getProposalApplyButtonLabel(input: { isApplied: boolean; isApplying: boolean; hasExistingSchedule: boolean }): string {
  if (input.isApplied) return 'Применено'
  if (input.isApplying) return 'Применяем…'
  return input.hasExistingSchedule ? 'Заменить расписание' : 'Применить'
}

export function getProposalActionSemantics(input: { messageId?: string; isApplying: boolean; isApplied: boolean; hasExistingSchedule: boolean }) {
  return {
    applyLabel: getProposalApplyButtonLabel(input),
    applyDisabled: !input.messageId || input.isApplying || input.isApplied,
    discussLabel: 'Обсудить изменения',
    discussDisabled: input.isApplying,
    dismissLabel: 'Отменить',
    dismissDisabled: input.isApplying,
  }
}

export default function DailyScheduleProposalCard({
  metadata,
  messageId,
  isApplying,
  onApply,
  onDiscuss,
  onDismiss,
}: DailyScheduleProposalCardProps) {
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [error, setError] = useState('')
  const hasExistingSchedule = proposalHasExistingSchedule(metadata)
  const isApplied = Boolean(metadata.appliedAt)
  const summary = useMemo(() => getProposalLoadSummary(metadata), [metadata])
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
          <h3 className="text-sm font-semibold text-gray-100">Черновик расписания</h3>
          <p className="text-xs text-gray-400">
            {getProposalBoundaryText(metadata)} · {blocks.length} блоков
          </p>
        </div>
        {isApplied && (
          <span className="rounded-full border border-green-500/40 bg-green-500/10 px-2 py-1 text-xs font-medium text-green-300" role="status">
            Применено
          </span>
        )}
      </div>

      <div className="mb-2 rounded-lg border border-gray-800 bg-gray-950/50 p-2 text-xs text-gray-300">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span>Занято: <b className="text-gray-100">{formatDurationLabel(summary.scheduledMinutes)} ({summary.scheduledPercent}%)</b></span>
          <span>Свободно: <b className="text-gray-100">{formatDurationLabel(summary.unscheduledMinutes)} ({summary.unscheduledPercent}%)</b></span>
          {Object.entries(summary.categories).map(([category, value]) => value.minutes > 0 && (
            <span key={category}>{categoryLabel[category as keyof typeof categoryLabel]}: {formatDurationLabel(value.minutes)} · {value.percent}%</span>
          ))}
        </div>
        <p className="mt-1 text-gray-400">{summary.recommendation}</p>
      </div>

      <div className="space-y-1.5">
        {blocks.map((block, index) => {
          const title = block.kind === 'task' ? block.taskText : block.title
          const fixed = isProposalBlockFixed(block)
          return (
            <div key={`${block.kind}-${block.startMinutes}-${index}`} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${kindClass[block.kind]}`} title={fixed ? 'Фиксированное время' : undefined} aria-label={`${title}, ${getProposalBlockMetaLabel(block)}`}>
              <div className="w-24 shrink-0 text-xs font-medium">
                {minutesToTimeLabel(block.startMinutes)}–{minutesToTimeLabel(block.startMinutes + block.durationMinutes)}
              </div>
              <div className="min-w-0 flex-1 truncate text-sm">{title}</div>
              {fixed && <span className="rounded border border-amber-400/60 bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-100">фикс.</span>}
              <div className="hidden shrink-0 text-xs opacity-80 sm:block">{getProposalBlockMetaLabel(block)}</div>
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

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={!messageId || isApplying || isApplied}
          className="min-h-11 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400 sm:min-h-0"
          aria-disabled={!messageId || isApplying || isApplied}
        >
          {getProposalApplyButtonLabel({ isApplied, isApplying, hasExistingSchedule })}
        </button>
        <button type="button" onClick={onDiscuss} disabled={isApplying} className="min-h-11 rounded-xl border border-gray-700 px-3 py-2 text-sm font-medium text-gray-100 hover:bg-gray-800 disabled:opacity-50 sm:min-h-0">
          Обсудить изменения
        </button>
        <button type="button" onClick={onDismiss} disabled={isApplying} className="min-h-11 rounded-xl border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 disabled:opacity-50 sm:col-span-2 sm:min-h-0">
          Отменить
        </button>
      </div>
      {!messageId && <p className="mt-1 text-xs text-gray-500">Кнопка станет доступна после сохранения ответа ассистента.</p>}
      {isApplied && <p className="mt-2 text-sm text-green-300" role="status">Расписание применено и шкала обновлена.</p>}
    </section>
  )
}
