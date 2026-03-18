'use client'

import { useState } from 'react'
import { formatHorizon } from '@/lib/dates'

interface DreamProgressProps {
  dreamGoal: string
  months?: number | null
}

export default function DreamProgress({ dreamGoal, months }: DreamProgressProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const horizonLabel = months ? formatHorizon(months) : null

  if (!dreamGoal || dreamGoal === 'Не указана') {
    return (
      <div className="relative overflow-hidden rounded-[28px] border-2 border-red-800/60 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.12),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-6">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
            <svg className="h-7 w-7 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
          </div>
          <h2 className="text-xl font-semibold text-white">У тебя нет мечты</h2>
          <p className="text-sm text-slate-400 leading-6 max-w-xs mx-auto">
            Система создана, чтобы привести тебя к мечте. Без неё невозможно оценить прогресс.
          </p>
          <a href="/goals" className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-red-600 to-red-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:from-red-500 hover:to-red-400">
            Создать мечту →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.10),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-6 shadow-[0_18px_60px_rgba(2,6,23,0.35)]">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.02),transparent)] pointer-events-none" />
      <div className="relative flex flex-col h-full">
        {/* Заголовок */}
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10">
              <svg className="h-5 w-5 text-amber-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Вектор</div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-100">Твоя мечта</h2>
            </div>
          </div>
          <a
            href="/goals"
            className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-sky-300 transition hover:border-sky-500/40 hover:text-sky-200"
          >
            Редактировать →
          </a>
        </div>

        {/* Текст мечты */}
        <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
          <p className={`text-[15px] text-slate-200 font-medium leading-7 break-words ${isExpanded ? '' : 'line-clamp-3'}`}>
            {dreamGoal}
          </p>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 text-sm font-semibold text-amber-300/80 transition hover:text-amber-200"
          >
            {isExpanded ? 'Свернуть ↑' : 'Показать полностью ↓'}
          </button>
        </div>

        {/* Горизонт */}
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/35 px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Горизонт</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">{horizonLabel || 'не задан'}</div>
          </div>
          <div className="text-sm text-slate-500 leading-6 text-right max-w-[200px]">
            Мечта должна быть опорой для недель и дней
          </div>
        </div>
      </div>
    </div>
  )
}
