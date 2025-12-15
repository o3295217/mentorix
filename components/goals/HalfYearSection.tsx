'use client'

import { useState } from 'react'

interface HalfYearSectionProps {
  half: number // 1 or 2
  year: number
  goals: string[]
  onAddGoal: (text: string) => void
  onRemoveGoal: (index: number) => void
  onEditGoal: (index: number, text: string) => void
}

export default function HalfYearSection({
  half,
  year: _year,
  goals,
  onAddGoal,
  onRemoveGoal,
  onEditGoal,
}: HalfYearSectionProps) {
  const [newGoal, setNewGoal] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')

  const halfColors = half === 1 
    ? 'from-cyan-400 to-teal-500' 
    : 'from-indigo-400 to-purple-500'
  const halfBgColors = half === 1 
    ? 'bg-gradient-to-r from-cyan-50 to-teal-50 border-cyan-200' 
    : 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200'
  const halfTextColor = half === 1 ? 'text-cyan-600' : 'text-indigo-600'

  const handleAdd = () => {
    if (newGoal.trim()) {
      onAddGoal(newGoal)
      setNewGoal('')
    }
  }

  const handleSaveEdit = (index: number) => {
    if (editingText.trim()) {
      onEditGoal(index, editingText)
    }
    setEditingIndex(null)
    setEditingText('')
  }

  return (
    <div className={`rounded-lg border-2 p-3 ${halfBgColors}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${halfColors} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
          H{half}
        </span>
        <span className="font-semibold">
          {half === 1 ? 'Первое полугодие' : 'Второе полугодие'}
        </span>
        <span className={`text-sm ${halfTextColor}`}>
          ({goals.length} {goals.length === 1 ? 'цель' : goals.length < 5 ? 'цели' : 'целей'})
        </span>
      </div>

      {/* Поле добавления цели для полугодия */}
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={newGoal}
          onChange={(e) => setNewGoal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={`Цель на ${half === 1 ? 'первое' : 'второе'} полугодие...`}
          className="flex-1 px-3 py-1.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
        />
        <button
          onClick={handleAdd}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r ${halfColors} hover:opacity-90 transition-opacity`}
        >
          + Добавить
        </button>
      </div>

      {/* Список целей полугодия */}
      <div className="space-y-1">
        {goals.length === 0 ? (
          <div className="text-center py-4 bg-white/50 rounded-lg border border-dashed border-gray-200">
            <span className="text-2xl block mb-1">📋</span>
            <p className="text-gray-400 text-xs">
              Нет целей на {half === 1 ? 'первое' : 'второе'} полугодие
            </p>
          </div>
        ) : (
          goals.map((goal, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-100 shadow-sm"
            >
              <span className={`w-5 h-5 rounded-full bg-gradient-to-br ${halfColors} flex items-center justify-center text-white text-xs`}>
                {index + 1}
              </span>
              {editingIndex === index ? (
                <input
                  type="text"
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onBlur={() => handleSaveEdit(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(index)
                    if (e.key === 'Escape') { setEditingIndex(null); setEditingText('') }
                  }}
                  className="flex-1 px-2 py-0.5 text-sm border-2 border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                  autoFocus
                />
              ) : (
                <span 
                  className="flex-1 text-sm cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => {
                    setEditingIndex(index)
                    setEditingText(goal)
                  }}
                  title="Нажмите для редактирования"
                >
                  {goal}
                </span>
              )}
              <button
                onClick={() => {
                  setEditingIndex(index)
                  setEditingText(goal)
                }}
                className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded p-1 transition-colors text-xs"
                title="Редактировать"
              >
                ✏️
              </button>
              <button
                onClick={() => onRemoveGoal(index)}
                className="text-red-400 hover:text-red-600 text-xs p-1 hover:bg-red-50 rounded transition-colors"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
