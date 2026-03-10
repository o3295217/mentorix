'use client'

import { useState } from 'react'

interface DreamProgressProps {
  dreamGoal: string
  years?: number
}

export default function DreamProgress({ dreamGoal, years }: DreamProgressProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Если нет мечты
  if (!dreamGoal || dreamGoal === 'Не указана') {
    return (
      <div className="card bg-red-950/30 border-2 border-red-800">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-900 mb-4"> У тебя нет мечты</h2>
          <p className="text-red-300 mb-4">
            Невозможно оценить твой прогресс, потому что ты не знаешь КУДА идешь.
          </p>
          <p className="text-red-400 mb-6">
            Эта система создана чтобы привести тебя к мечте. Без мечты она бесполезна.
          </p>
          <a href="/goals" className="btn-primary bg-red-600 hover:bg-red-700">
            Создать мечту →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="card bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-purple-700">
      <div className="flex items-start gap-3">
        <div className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0 mt-1.5"></div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-gray-400 mb-1">Твоя мечта{years ? ` (${years} ${years === 1 ? 'год' : years < 5 ? 'года' : 'лет'})` : ''}</h2>
          <p className={`text-lg text-gray-100 font-medium leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
            "{dreamGoal}"
          </p>
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-base text-purple-400 font-medium hover:text-purple-300"
            >
              {isExpanded ? 'Свернуть ↑' : 'Показать полностью ↓'}
            </button>
            <a
              href="/goals"
              className="text-base text-purple-400 hover:underline font-medium hover:text-purple-300"
            >
              Редактировать →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
