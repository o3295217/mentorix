'use client'

import { useMemo, useState } from 'react'
import type { DailyScheduleProposalMetadata } from '@/lib/daily-schedule-proposal'
import { formatDurationLabel, minutesToTimeLabel } from '@/hooks/daily/schedule-helpers'
import { buildProposalApplyOptions, getProposalLoadSummary, getProposalNewTasks, proposalHasExistingSchedule, type ProposalApplyOptions } from '@/hooks/daily/proposal-helpers'
import ScheduleLoadSummary from '@/components/daily/ScheduleLoadSummary'

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
  task: 'border-blue-400/25 bg-blue-500/10 text-blue-100',
  meal: 'border-orange-400/25 bg-orange-500/10 text-orange-100',
  rest: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100',
  buffer: 'border-purple-400/25 bg-purple-500/10 text-purple-100',
} as const

type ProposalBlock = DailyScheduleProposalMetadata['proposal']['blocks'][number]

export function isProposalBlockFixed(block: ProposalBlock): boolean {
  return 'isFixed' in block && block.isFixed === true
}

export function getProposalBoundaryText(metadata: DailyScheduleProposalMetadata): string {
  return `старт ${minutesToTimeLabel(metadata.proposal.version !== 1 ? metadata.proposal.planningStartMinutes : metadata.proposal.dayStartMinutes)} · работа до ${minutesToTimeLabel(metadata.proposal.version !== 1 ? metadata.proposal.workEndMinutes : metadata.proposal.dayEndMinutes)} · активность до ${minutesToTimeLabel(metadata.proposal.version !== 1 ? metadata.proposal.activityEndMinutes : metadata.proposal.dayEndMinutes)}`
}

export function formatProposalNewTasksCount(count: number): string {
  const lastTwoDigits = count % 100
  const lastDigit = count % 10
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${count} новых задач`
  if (lastDigit === 1) return `${count} новая задача`
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} новые задачи`
  return `${count} новых задач`
}

export function getProposalTitle(input: { hasExistingSchedule: boolean; newTaskCount: number }): string {
  if (input.hasExistingSchedule) return 'Новый вариант расписания'
  return input.newTaskCount > 0 ? 'Черновик расписания с новыми задачами' : 'Черновик расписания'
}

export function getProposalSummaryText(input: { boundaryText: string; blockCount: number; newTaskCount: number }): string {
  const newTasksText = input.newTaskCount > 0 ? ` · ${formatProposalNewTasksCount(input.newTaskCount)}` : ''
  return `${input.boundaryText} · ${input.blockCount} блоков${newTasksText}`
}

export function getProposalBlockMetaLabel(block: ProposalBlock): string {
  const fixed = isProposalBlockFixed(block)
  const primaryLabel = 'category' in block ? categoryLabel[block.category] : kindLabel[block.kind]
  return `${primaryLabel} · ${formatDurationLabel(block.durationMinutes)}${fixed ? ' · фиксированное время' : ''}`
}

export function getProposalApplyButtonLabel(input: { isApplied: boolean; isApplying: boolean; hasExistingSchedule: boolean; hasNewTasks?: boolean }): string {
  if (input.isApplied) return 'Применено'
  if (input.isApplying) return 'Применяем…'
  return input.hasNewTasks ? 'Добавить и применить' : 'Применить'
}

export function getProposalActionSemantics(input: { messageId?: string; isApplying: boolean; isApplied: boolean; hasExistingSchedule: boolean; hasNewTasks?: boolean }) {
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
  const newTasks = useMemo(() => getProposalNewTasks(metadata), [metadata])
  const hasNewTasks = newTasks.length > 0
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
    <section className="mt-3 border-l-2 border-primary-500/40 py-1 pl-3" aria-label="Предложение расписания">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-100">{getProposalTitle({ hasExistingSchedule, newTaskCount: newTasks.length })}</h3>
          <p className="text-xs text-gray-400">
            {getProposalSummaryText({ boundaryText: getProposalBoundaryText(metadata), blockCount: blocks.length, newTaskCount: newTasks.length })}
          </p>
        </div>
        {isApplied && (
          <span className="rounded-full border border-green-500/40 bg-green-500/10 px-2 py-1 text-xs font-medium text-green-300" role="status">
            Применено
          </span>
        )}
      </div>

      {(hasNewTasks || hasExistingSchedule) && (
        <p className={`mb-2 rounded-lg border px-2.5 py-2 text-xs leading-5 ${hasExistingSchedule ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-blue-500/30 bg-blue-500/10 text-blue-100'}`}>
          {hasExistingSchedule
            ? 'Уже есть расписание на этот день. Этот вариант заменит текущую шкалу после подтверждения.'
            : 'Ментрикс предлагает добавить новые задачи и сразу поставить их в расписание. Ничего не изменится, пока вы не нажмёте "Применить".'}
        </p>
      )}

      <ScheduleLoadSummary summary={summary} className="mb-2" />

      <div className="space-y-1.5">
        {blocks.map((block, index) => {
          const title = block.kind === 'task' ? block.taskText : block.title
          const fixed = isProposalBlockFixed(block)
          const isNewTaskBlock = block.kind === 'task' && 'taskSource' in block && block.taskSource === 'new'
          return (
            <div key={`${block.kind}-${block.startMinutes}-${index}`} className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg border px-2 py-1 ${kindClass[block.kind]}`} title={fixed ? 'Фиксированное время' : undefined} aria-label={`${title}, ${getProposalBlockMetaLabel(block)}`}>
              <span className="shrink-0 text-[11px] font-medium tabular-nums opacity-75">
                {minutesToTimeLabel(block.startMinutes)}–{minutesToTimeLabel(block.startMinutes + block.durationMinutes)}
              </span>
              <span className="min-w-0 flex-1 break-words text-sm">{title}</span>
              {isNewTaskBlock && <span className="shrink-0 rounded-full border border-cyan-300/50 bg-cyan-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-100">новая</span>}
              {fixed && <span className="shrink-0 rounded border border-amber-400/60 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100">фикс.</span>}
              <span className="w-full break-words text-[11px] opacity-70">{getProposalBlockMetaLabel(block)}</span>
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
          {getProposalApplyButtonLabel({ isApplied, isApplying, hasExistingSchedule, hasNewTasks })}
        </button>
        <button type="button" onClick={onDiscuss} disabled={isApplying} className="min-h-11 rounded-xl border border-gray-700 px-3 py-2 text-sm font-medium text-gray-100 hover:bg-gray-800 disabled:opacity-50 sm:min-h-0">
          Обсудить изменения
        </button>
        <button type="button" onClick={onDismiss} disabled={isApplying} className="min-h-11 rounded-xl border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 disabled:opacity-50 sm:col-span-2 sm:min-h-0">
          Отменить
        </button>
      </div>
      {!messageId && <p className="mt-1 text-xs text-gray-500">Кнопка станет доступна после сохранения ответа ассистента.</p>}
      {isApplied && <p className="mt-2 text-sm text-green-300" role="status">{hasNewTasks ? 'Новые задачи добавлены, расписание применено.' : 'Расписание применено, шкала дня обновлена.'}</p>}
    </section>
  )
}
