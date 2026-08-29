'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { DailyScheduleProposalMetadata } from '@/lib/daily-schedule-proposal'
import type { DailyScheduleBlockCategory } from '@/lib/daily-schedule'
import { formatDurationLabel, minutesToTimeLabel } from '@/hooks/daily/schedule-helpers'
import { buildProposalApplyOptions, getProposalLoadSummary, getProposalNewTasks, proposalHasExistingSchedule, type ProposalApplyOptions } from '@/hooks/daily/proposal-helpers'
import ScheduleLoadSummary, { CATEGORY_BAR_COLOR } from '@/components/daily/ScheduleLoadSummary'

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

type ProposalBlock = DailyScheduleProposalMetadata['proposal']['blocks'][number]

// v2/v3 blocks carry an explicit `category`; v1 blocks only have `kind`. For those,
// `meal`/`rest`/`buffer` map 1:1 onto category keys, and a plain `task` (no category
// info at all) is treated as generic work — same bucket as `main`.
function getProposalBlockCategoryKey(block: ProposalBlock): DailyScheduleBlockCategory {
  if ('category' in block) return block.category
  if (block.kind === 'meal' || block.kind === 'rest' || block.kind === 'buffer') return block.kind
  return 'main'
}

// Reuses ScheduleLoadSummary's category colors (bg-* utility) as a left border stripe,
// so the row's category indicator and the load summary bar always agree.
// Полные литеральные классы — Tailwind генерирует CSS только для классов,
// которые видит в коде буквально; собранный заменой строки класс останется без стилей.
const CATEGORY_STRIPE_CLASS: Record<keyof typeof CATEGORY_BAR_COLOR, string> = {
  main: 'border-primary-500',
  operational: 'border-purple-500',
  travel: 'border-cyan-500',
  personal: 'border-pink-500',
  meal: 'border-orange-500',
  rest: 'border-emerald-500',
  buffer: 'border-gray-500',
}

export function getProposalBlockStripeClass(block: ProposalBlock): string {
  return CATEGORY_STRIPE_CLASS[getProposalBlockCategoryKey(block)]
}

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

export function getProposalApplyButtonLabel(input: { isApplied: boolean; isApplying: boolean; hasExistingSchedule: boolean; hasNewTasks?: boolean; isConfirmingReplace?: boolean }): string {
  if (input.isApplied) return 'Применено'
  if (input.isApplying) return 'Применяем…'
  if (input.isConfirmingReplace) return 'Заменить текущее расписание?'
  return input.hasNewTasks ? 'Добавить и применить' : 'Применить'
}

export function getProposalActionSemantics(input: { messageId?: string; isApplying: boolean; isApplied: boolean; hasExistingSchedule: boolean; hasNewTasks?: boolean; isConfirmingReplace?: boolean }) {
  return {
    applyLabel: getProposalApplyButtonLabel(input),
    applyDisabled: !input.messageId || input.isApplying || input.isApplied,
    discussLabel: 'Обсудить изменения',
    discussDisabled: input.isApplying,
    dismissLabel: input.isConfirmingReplace ? 'Не заменять' : 'Отменить',
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
  const sectionRef = useRef<HTMLElement | null>(null)
  const hasExistingSchedule = proposalHasExistingSchedule(metadata)
  const isApplied = Boolean(metadata.appliedAt)
  const newTasks = useMemo(() => getProposalNewTasks(metadata), [metadata])
  const hasNewTasks = newTasks.length > 0
  const summary = useMemo(() => getProposalLoadSummary(metadata), [metadata])
  const blocks = useMemo(
    () => [...metadata.proposal.blocks].sort((a, b) => a.startMinutes - b.startMinutes),
    [metadata.proposal.blocks],
  )
  const isConfirmingReplace = confirmReplace && !isApplied

  // Клик мимо карточки или Escape во время подтверждения замены возвращают кнопку
  // в исходное состояние — второй клик применяет только намеренно, а не случайно.
  useEffect(() => {
    if (!isConfirmingReplace) return

    const handlePointerDown = (event: MouseEvent) => {
      if (sectionRef.current && !sectionRef.current.contains(event.target as Node)) {
        setConfirmReplace(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirmReplace(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isConfirmingReplace])

  const handleClick = async () => {
    if (!messageId || isApplying || isApplied) return
    setError('')
    if (hasExistingSchedule && !confirmReplace) {
      setConfirmReplace(true)
      return
    }
    try {
      await onApply(buildProposalApplyOptions(metadata))
      setConfirmReplace(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось применить расписание')
    }
  }

  const handleDismissClick = () => {
    if (isConfirmingReplace) {
      setConfirmReplace(false)
      return
    }
    onDismiss()
  }

  return (
    <section
      ref={sectionRef}
      className={`mt-3 rounded-lg py-1 transition-colors ${isConfirmingReplace ? 'border-l-2 border-amber-400/80 bg-amber-500/5 pl-3' : ''}`}
      aria-label="Предложение расписания"
    >
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

      <div className="divide-y divide-gray-800/60">
        {blocks.map((block, index) => {
          const title = block.kind === 'task' ? block.taskText : block.title
          const fixed = isProposalBlockFixed(block)
          const isNewTaskBlock = block.kind === 'task' && 'taskSource' in block && block.taskSource === 'new'
          return (
            <div
              key={`${block.kind}-${block.startMinutes}-${index}`}
              className={`flex items-start gap-3 border-l-2 py-1.5 pl-2.5 pr-0.5 ${getProposalBlockStripeClass(block)}`}
              title={fixed ? 'Фиксированное время' : undefined}
              aria-label={`${title}, ${getProposalBlockMetaLabel(block)}`}
            >
              <span className="w-[6.5rem] shrink-0 whitespace-nowrap pt-0.5 text-[13px] tabular-nums text-gray-400">
                {minutesToTimeLabel(block.startMinutes)}–{minutesToTimeLabel(block.startMinutes + block.durationMinutes)}
              </span>
              <span className="min-w-0 flex-1 break-words text-sm text-gray-100">
                {title}
                {isNewTaskBlock && <span className="ml-1.5 inline-block shrink-0 rounded-full border border-cyan-300/50 bg-cyan-400/15 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-cyan-100">новая</span>}
                {fixed && <span className="ml-1.5 inline-block shrink-0 rounded border border-amber-400/60 bg-amber-500/15 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-amber-100">фикс.</span>}
              </span>
              <span className="shrink-0 whitespace-nowrap pt-0.5 text-right text-xs text-gray-400">
                {formatDurationLabel(block.durationMinutes)}
              </span>
            </div>
          )
        })}
      </div>

      {metadata.proposal.rationale && (
        <p className="mt-2 text-xs leading-5 text-gray-400">{metadata.proposal.rationale}</p>
      )}

      {error && <p className="mt-2 text-sm text-red-300" role="alert">{error}</p>}
      {isConfirmingReplace && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-400/50 bg-amber-500/10 px-2.5 py-2 text-xs font-medium leading-5 text-amber-200" role="status">
          <span aria-hidden>⚠</span>
          <span>Текущая шкала дня будет заменена. Нажмите «Заменить текущее расписание?» ещё раз, чтобы подтвердить, или «Не заменять», чтобы отменить.</span>
        </p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={!messageId || isApplying || isApplied}
          className={`min-h-11 rounded-xl px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400 sm:min-h-0 ${isConfirmingReplace ? 'btn-dirty-attention bg-amber-500 text-gray-950 hover:bg-amber-400' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
          aria-disabled={!messageId || isApplying || isApplied}
        >
          {getProposalApplyButtonLabel({ isApplied, isApplying, hasExistingSchedule, hasNewTasks, isConfirmingReplace })}
        </button>
        <button type="button" onClick={onDiscuss} disabled={isApplying} className="min-h-11 rounded-xl border border-gray-700 px-3 py-2 text-sm font-medium text-gray-100 hover:bg-gray-800 disabled:opacity-50 sm:min-h-0">
          Обсудить изменения
        </button>
        <button type="button" onClick={handleDismissClick} disabled={isApplying} className="min-h-11 rounded-xl border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 disabled:opacity-50 sm:col-span-2 sm:min-h-0">
          {isConfirmingReplace ? 'Не заменять' : 'Отменить'}
        </button>
      </div>
      {!messageId && <p className="mt-1 text-xs text-gray-500">Кнопка станет доступна после сохранения ответа ассистента.</p>}
      {isApplied && <p className="mt-2 text-sm text-green-300" role="status">{hasNewTasks ? 'Новые задачи добавлены, расписание применено.' : 'Расписание применено, шкала дня обновлена.'}</p>}
    </section>
  )
}
