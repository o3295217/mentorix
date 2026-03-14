'use client'

import { useState, useEffect } from 'react'
import { DreamGoal } from '@/lib/types'

interface DreamBarProps {
  dreamGoal: DreamGoal | null
  onSave: (text: string, years: number) => Promise<void>
  progress: { total: number; completed: number; percent: number }
  isSetup: boolean
  onSetupComplete: () => void
  onOpenChat: () => void
}

export default function DreamBar({ dreamGoal, onSave, progress, isSetup, onSetupComplete, onOpenChat }: DreamBarProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [text, setText] = useState('')
  const [years, setYears] = useState(5)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (dreamGoal) {
      setText(dreamGoal.goalText)
      setYears(dreamGoal.years)
    }
  }, [dreamGoal])

  const handleSave = async () => {
    if (!text.trim()) return
    setSaving(true)
    try {
      await onSave(text, years)
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  // State 0: No dream — show creation prompt
  if (!dreamGoal && !isEditing) {
    return (
      <div className="flex flex-col items-center justify-center py-10 sm:py-16 px-4">
        <div className="text-5xl mb-6">🌟</div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-100 dark:text-gray-100 mb-3">
          Напиши свою мечту
        </h2>
        <p className="text-gray-400 mb-8 text-center max-w-lg leading-relaxed">
          С чего начинается любой великий путь? С мечты. Опиши, чего хочешь достичь —
          и мы построим план от этой точки.
        </p>
        <button
          onClick={() => setIsEditing(true)}
          className="btn-primary px-8 py-3 text-lg font-semibold"
        >
          Создать мечту
        </button>
      </div>
    )
  }

  // Edit / Create mode
  if (isEditing || !dreamGoal) {
    return (
      <div className="card ring-1 ring-blue-500/20">
        <h3 className="text-sm font-medium text-gray-400 mb-3">
          {dreamGoal ? 'Редактировать мечту' : 'Твоя мечта'}
        </h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="input resize-none text-base"
          rows={3}
          placeholder="Например: Построить международную IT-компанию и жить у океана..."
          autoFocus
        />
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-400">Горизонт:</span>
            {[1, 3, 5, 10].map((y) => (
              <button
                key={y}
                onClick={() => setYears(y)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  years === y
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700'
                }`}
              >
                {y} {y === 1 ? 'год' : y < 5 ? 'года' : 'лет'}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          {dreamGoal && (
            <button
              onClick={() => {
                setIsEditing(false)
                setText(dreamGoal.goalText)
                setYears(dreamGoal.years)
              }}
              className="btn-secondary text-sm"
            >
              Отмена
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Сохраняю...' : 'Сохранить'}
          </button>
        </div>
      </div>
    )
  }

  // State 1: Setup mode — dream exists, no goals yet
  if (isSetup) {
    return (
      <div className="space-y-4">
        <div className="card ring-1 ring-blue-500/20">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🌟</span>
                <h2 className="text-lg font-bold text-white">Твоя мечта</h2>
              </div>
              <p className="text-gray-300 italic leading-relaxed">&ldquo;{dreamGoal.goalText}&rdquo;</p>
              <p className="text-xs text-gray-500 mt-2">
                Горизонт: {dreamGoal.years} {dreamGoal.years === 1 ? 'год' : dreamGoal.years < 5 ? 'года' : 'лет'}
              </p>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="text-gray-500 hover:text-gray-300 p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="card border-2 border-dashed border-gray-700/50 text-center py-10">
          <h3 className="text-lg font-semibold text-gray-200 mb-2">Готов планировать?</h3>
          <p className="text-sm text-gray-400 mb-8 max-w-md mx-auto">
            Разложи мечту на годы, кварталы и месяцы — сам или с помощью ИИ
          </p>
          <div className="flex gap-3 sm:gap-4 justify-center flex-wrap">
            <button
              onClick={onSetupComplete}
              className="btn-secondary px-6 py-3 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Заполню сам
            </button>
            <button
              onClick={() => {
                onSetupComplete()
                onOpenChat()
              }}
              className="btn-primary px-6 py-3 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              ИИ поможет
            </button>
          </div>
        </div>
      </div>
    )
  }

  // State 2: Compact bar
  return (
    <div
      className="group flex items-center gap-4 rounded-2xl py-3 px-5 bg-gray-900/60 border border-gray-800 hover:border-gray-700 cursor-pointer transition-all"
      onClick={() => setIsEditing(true)}
    >
      <span className="text-lg flex-shrink-0">🌟</span>
      <div className="flex-1 min-w-0">
        <p className="text-gray-200 truncate font-medium">{dreamGoal.goalText}</p>
      </div>
      {progress.total > 0 && (
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 tabular-nums">{progress.percent}%</span>
        </div>
      )}
      <span className="text-xs text-gray-600 flex-shrink-0">
        {dreamGoal.years} {dreamGoal.years === 1 ? 'г.' : 'л.'}
      </span>
      <svg
        className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </div>
  )
}
