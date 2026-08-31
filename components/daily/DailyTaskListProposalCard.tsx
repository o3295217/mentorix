'use client'

import { useState } from 'react'
import type { DailyTaskListProposalMetadata } from '@/lib/daily-schedule-proposal'
import { DAILY_SCHEDULE_ISSUE_ACTIONS, type DailyScheduleIssueAction } from '@/lib/daily-chat-constants'

export interface DailyTaskListProposalCardProps {
  metadata: DailyTaskListProposalMetadata
  messageId?: string
  isApplying: boolean
  isChatBusy: boolean
  onApply: () => Promise<void>
  onScheduleIssueAction: (marker: string, action: DailyScheduleIssueAction) => Promise<void>
}

function getApplyButtonLabel(input: { isApplied: boolean; isApplying: boolean }): string {
  if (input.isApplied) return 'Добавлено в план'
  if (input.isApplying) return 'Добавляем…'
  return 'Добавить в план'
}

export default function DailyTaskListProposalCard({
  metadata,
  messageId,
  isApplying,
  isChatBusy,
  onApply,
  onScheduleIssueAction,
}: DailyTaskListProposalCardProps) {
  const [error, setError] = useState('')
  const isApplied = Boolean(metadata.appliedAt)

  const handleClick = async () => {
    if (!messageId || isApplying || isApplied) return
    setError('')
    try {
      await onApply()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить задачи в план')
    }
  }

  const handleScheduleIssueAction = async (marker: string, action: DailyScheduleIssueAction) => {
    if (!isApplied || isChatBusy) return
    setError('')
    try {
      await onScheduleIssueAction(marker, action)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить запрос на расписание')
    }
  }

  return (
    <section className="mt-3 max-w-xl rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-gray-900 to-gray-950 p-3 shadow-lg shadow-cyan-950/20" aria-label="Предложение списка задач">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="type-card-title">Предложение списка задач</h3>
          <p className="type-secondary">{metadata.tasks.length} задач можно добавить в план дня</p>
        </div>
        {isApplied && (
          // Вне шкалы: статусный бейдж-пилюля, как «фикс.»/«новая».
          <span className="rounded-full border border-green-500/40 bg-green-500/10 px-2 py-1 text-xs font-medium text-green-300" role="status">
            Добавлено
          </span>
        )}
      </div>

      {metadata.scheduleIssue?.reason && (
        <p className="type-caption mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 leading-5 text-amber-100">
          {metadata.scheduleIssue.reason}
        </p>
      )}

      {metadata.scheduleIssue && (
        <div className="mb-3 rounded-xl border border-gray-700 bg-gray-900/80 p-3">
          <p className="type-secondary font-medium text-gray-200">Как собрать временную шкалу?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DAILY_SCHEDULE_ISSUE_ACTIONS.map((item) => (
              <button
                key={item.action}
                type="button"
                onClick={() => void handleScheduleIssueAction(item.marker, item.action)}
                disabled={!isApplied || isChatBusy}
                className="min-h-10 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
              >
                {item.label}
              </button>
            ))}
          </div>
          {!isApplied && <p className="type-caption mt-2">Сначала добавьте список в план — тогда ассистент увидит эти задачи и разложит их по времени.</p>}
          {isApplied && isChatBusy && <p className="type-caption mt-2 text-cyan-200" role="status">Ассистент собирает расписание…</p>}
        </div>
      )}

      <div className="space-y-1.5">
        {metadata.tasks.map((task, index) => (
          <div key={`${index}-${task}`} className="type-body rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2 py-1.5 text-cyan-50">
            {/* Вне шкалы: компактный номерной маркер, аналог буллита списка, не текстовая роль. */}
            <span className="mr-2 text-xs font-semibold text-cyan-300">{index + 1}.</span>
            {task}
          </div>
        ))}
      </div>

      {error && <p className="type-body mt-2 text-red-300" role="alert">{error}</p>}

      <div className="mt-3">
        <button
          type="button"
          onClick={handleClick}
          disabled={!messageId || isApplying || isApplied}
          className="min-h-11 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400 sm:min-h-0"
          aria-disabled={!messageId || isApplying || isApplied}
        >
          {getApplyButtonLabel({ isApplied, isApplying })}
        </button>
      </div>
      {!messageId && <p className="type-caption mt-1">Кнопка станет доступна после сохранения ответа ассистента.</p>}
      {isApplied && <p className="type-body mt-2 text-green-300" role="status">Список задач добавлен в план.</p>}
    </section>
  )
}
