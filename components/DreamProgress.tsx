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
      {/* Компактный вид */}
      <div
        className="flex items-center justify-between gap-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="text-3xl flex-shrink-0">🌟</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Твоя мечта (5 лет)</h2>
            <p className="text-base text-gray-900 dark:text-gray-100 font-medium truncate">"{dreamGoal}"</p>
          </div>
        </div>

        {/* Стрелка раскрытия */}
        <button
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-transform flex-shrink-0"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Развернутый вид */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-700">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Полный текст мечты:</h3>
              <p className="text-base text-gray-800 dark:text-gray-200 italic leading-relaxed">"{dreamGoal}"</p>
            </div>

            <div className="flex justify-end">
              <a
                href="/goals"
                className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline text-sm font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                Редактировать мечту и цели →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
