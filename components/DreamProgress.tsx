'use client'

import { useState } from 'react'

interface DreamProgressProps {
  dreamGoal: string
}

export default function DreamProgress({ dreamGoal }: DreamProgressProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Если нет мечты
  if (!dreamGoal || dreamGoal === 'Не указана') {
    return (
      <div className="card bg-red-50 border-2 border-red-300">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-900 mb-4">⚠️ У тебя нет мечты</h2>
          <p className="text-red-800 mb-4">
            Невозможно оценить твой прогресс, потому что ты не знаешь КУДА идешь.
          </p>
          <p className="text-red-700 mb-6">
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
    <div className="card bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 dark:from-purple-900/20 dark:to-blue-900/20 dark:border-purple-700">
      <div className="flex items-start gap-3">
        <div className="text-3xl flex-shrink-0">🌟</div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-gray-600 dark:text-gray-400 mb-1">Твоя мечта (5 лет)</h2>
          <p className={`text-lg text-gray-900 dark:text-gray-100 font-medium leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
            "{dreamGoal}"
          </p>
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-base text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
            >
              {isExpanded ? 'Свернуть ↑' : 'Показать полностью ↓'}
            </button>
            <a
              href="/goals"
              className="text-base text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline font-medium"
            >
              Редактировать →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
