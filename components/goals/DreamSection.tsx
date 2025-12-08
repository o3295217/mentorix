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
      // Можно добавить toast уведомление об ошибке
    } finally {
      setSaving(false)
    }
  }

  if (!dreamGoal && !isEditing) {
    return (
      <div className="bg-gradient-to-r from-purple-100 to-blue-100 p-8 rounded-2xl shadow-sm border border-purple-200 text-center">
        <h2 className="text-2xl font-bold text-purple-900 mb-4">🌟 У тебя пока нет Мечты</h2>
        <p className="text-purple-800 mb-6 max-w-2xl mx-auto">
          "Человек без мечты, как птица без крыльев". Давай определим твою главную цель на ближайшие годы.
          Это станет фундаментом для всей системы планирования.
        </p>
        <button
          onClick={() => setIsEditing(true)}
          className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition-colors shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
        >
          Создать Мечту
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-2xl shadow-sm border border-purple-100">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">🌟</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Твоя Мечта</h2>
            <p className="text-sm text-gray-500">Горизонт планирования: {years} {years === 1 ? 'год' : years < 5 ? 'года' : 'лет'}</p>
          </div>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-gray-400 hover:text-purple-600 transition-colors p-2 hover:bg-white/50 rounded-lg"
            title="Редактировать мечту"
          >
            ✏️
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4 bg-white/50 p-4 rounded-xl border border-purple-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Опиши свою мечту (чего ты хочешь достичь?):
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-purple-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all resize-none text-lg"
              rows={3}
              placeholder="Например: Построить международную IT-компанию и жить у океана..."
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Горизонт планирования (лет):
            </label>
            <div className="flex gap-2">
              {[1, 3, 5, 10].map((y) => (
                <button
                  key={y}
                  onClick={() => setYears(y)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    years === y
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white text-gray-600 hover:bg-purple-50 border border-gray-200'
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
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !text.trim()}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? 'Сохранение...' : 'Сохранить Мечту'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white/60 p-6 rounded-xl border border-purple-100 backdrop-blur-sm">
          <p className="text-xl text-gray-800 leading-relaxed font-medium italic">
            "{dreamGoal?.goalText}"
          </p>
        </div>
      )}
    </div>
  )
}
