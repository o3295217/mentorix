'use client'

import { useState } from 'react'
import type { DailyTaskListProposalMetadata } from '@/lib/daily-schedule-proposal'

export interface DailyTaskListProposalCardProps {
  metadata: DailyTaskListProposalMetadata
  messageId?: string
  isApplying: boolean
  onApply: () => Promise<void>
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
  onApply,
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

  return (
    <section className="mt-3 max-w-xl rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-gray-900 to-gray-950 p-3 shadow-lg shadow-cyan-950/20" aria-label="Предложение списка задач">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-100">Предложение списка задач</h3>
          <p className="text-xs text-gray-400">{metadata.tasks.length} задач можно добавить в план дня</p>
        </div>
        {isApplied && (
          <span className="rounded-full border border-green-500/40 bg-green-500/10 px-2 py-1 text-xs font-medium text-green-300" role="status">
            Добавлено
          </span>
        )}
      </div>

      {metadata.scheduleIssue?.reason && (
        <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs leading-5 text-amber-100">
          {metadata.scheduleIssue.reason}
        </p>
      )}

      <div className="space-y-1.5">
        {metadata.tasks.map((task, index) => (
          <div key={`${index}-${task}`} className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2 py-1.5 text-sm text-cyan-50">
            <span className="mr-2 text-xs font-semibold text-cyan-300">{index + 1}.</span>
            {task}
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-red-300" role="alert">{error}</p>}

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
      {!messageId && <p className="mt-1 text-xs text-gray-500">Кнопка станет доступна после сохранения ответа ассистента.</p>}
      {isApplied && <p className="mt-2 text-sm text-green-300" role="status">Список задач добавлен в план.</p>}
    </section>
  )
}
