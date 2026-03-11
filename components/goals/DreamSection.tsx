'use client'

import { useState, useEffect } from 'react'

interface DreamGoal {
  id: number
  goalText: string
  years: number
}

interface DreamSectionProps {
  dreamGoal: DreamGoal | null
  onSave: (text: string, years: number) => Promise<void>
  progress?: { total: number; completed: number; percent: number }
}

export default function DreamSection({ dreamGoal, onSave, progress }: DreamSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
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
    } catch (error) {
      console.error('Error saving dream:', error)
    } finally {
      setSaving(false)
    }
  }

  if (!dreamGoal && !isEditing) {
    return (
      <div className="card ring-1 ring-blue-500/20 text-center">
        <h2 className="text-2xl font-bold text-gray-100 mb-3">У тебя пока нет Мечты</h2>
        <p className="text-gray-400 mb-6 max-w-2xl mx-auto text-sm leading-relaxed">
          &ldquo;Человек без мечты, как птица без крыльев&rdquo;. Давай определим твою главную цель на ближайшие годы.
          Это станет фундаментом для всей системы планирования.
        </p>
        <button
          onClick={() => setIsEditing(true)}
          className="btn-primary px-6 py-3 font-semibold"
        >
          Создать Мечту
        </button>
      </div>
    )
  }

  return (
    <div className="card ring-1 ring-blue-500/20">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-bold text-white">Твоя Мечта</h2>
          <p className="text-xs text-gray-500">Горизонт планирования: {years} {years === 1 ? 'год' : years < 5 ? 'года' : 'лет'}</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg"
            title="Редактировать мечту"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              <path d="m15 5 4 4"/>
            </svg>
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Опиши свою мечту:
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="input resize-none text-base"
              rows={3}
              placeholder="Например: Построить международную IT-компанию и жить у океана..."
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Горизонт (лет):
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={30}
                value={years}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  if (v >= 1 && v <= 30) setYears(v)
                }}
                className="w-20 px-3 py-1.5 text-sm border border-gray-700 rounded-lg bg-gray-900 text-center focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
              <div className="flex gap-1.5">
                {[1, 3, 5, 10].map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setYears(y)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      years === y
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-500 hover:text-gray-300 border border-gray-700'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-500">
                {years === 1 ? 'год' : years < 5 ? 'года' : 'лет'}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setIsEditing(false)
                if (dreamGoal) {
                  setText(dreamGoal.goalText)
                  setYears(dreamGoal.years)
                }
              }}
              className="btn-secondary text-sm"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !text.trim()}
              className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p
            className={`text-gray-200 leading-relaxed italic cursor-pointer ${!isExpanded ? 'line-clamp-2' : ''}`}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            &ldquo;{dreamGoal?.goalText}&rdquo;
          </p>
          {dreamGoal && dreamGoal.goalText.length > 120 && !isExpanded && (
            <button
              onClick={() => setIsExpanded(true)}
              className="text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors"
            >
              Показать полностью
            </button>
          )}
          {progress && progress.total > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 tabular-nums">
                {progress.completed}/{progress.total}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
