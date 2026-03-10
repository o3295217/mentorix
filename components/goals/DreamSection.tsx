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
}

export default function DreamSection({ dreamGoal, onSave }: DreamSectionProps) {
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
            className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 hover:bg-gray-800 rounded-lg text-sm"
            title="Редактировать мечту"
          >
            &#9998;
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
            <div className="flex gap-2">
              {[1, 3, 5, 10].map((y) => (
                <button
                  key={y}
                  onClick={() => setYears(y)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    years === y
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700'
                  }`}
                >
                  {y} {y === 1 ? 'год' : y < 5 ? 'года' : 'лет'}
                </button>
              ))}
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
        <p className="text-gray-200 leading-relaxed italic">
          &ldquo;{dreamGoal?.goalText}&rdquo;
        </p>
      )}
    </div>
  )
}
