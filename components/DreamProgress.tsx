'use client'

import { useState } from 'react'

interface DreamProgressProps {
  dreamGoal: string
  dreamProgressScore?: number
  showDetails?: boolean
}

export default function DreamProgress({
  dreamGoal,
  dreamProgressScore,
  showDetails = true,
}: DreamProgressProps) {
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

  // Цвет прогресса на основе score
  const getScoreColor = (score?: number) => {
    if (!score) return 'gray'
    if (score >= 7) return 'green'
    if (score >= 4) return 'yellow'
    return 'red'
  }

  const scoreColor = getScoreColor(dreamProgressScore)
  const scoreColorClasses = {
    green: 'text-green-600 bg-green-50 border-green-200',
    yellow: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    red: 'text-red-600 bg-red-50 border-red-200',
    gray: 'text-gray-600 bg-gray-50 border-gray-200',
  }

  return (
    <div className="card bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200">
      {/* Компактный вид */}
      <div
        className="flex items-center justify-between gap-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="text-3xl flex-shrink-0">🌟</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-600 mb-1">Твоя мечта (5 лет)</h2>
            <p className="text-base text-gray-900 font-medium truncate">"{dreamGoal}"</p>
          </div>
        </div>

        {/* Индикатор прогресса - всегда виден */}
        {showDetails && dreamProgressScore !== undefined && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 flex-shrink-0 ${scoreColorClasses[scoreColor]}`}>
            <span className="text-2xl font-bold">{dreamProgressScore}</span>
            <span className="text-xs text-gray-600">/10</span>
          </div>
        )}

        {/* Стрелка раскрытия */}
        <button
          className="text-gray-400 hover:text-gray-600 transition-transform flex-shrink-0"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Развернутый вид с деталями */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-purple-200">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Полный текст мечты:</h3>
              <p className="text-base text-gray-800 italic leading-relaxed">"{dreamGoal}"</p>
            </div>

            {showDetails && dreamProgressScore !== undefined && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Оценка прогресса сегодня:</h3>
                <div className="text-sm text-gray-700">
                  {dreamProgressScore >= 7 && (
                    <p className="flex items-center gap-2">
                      <span className="text-xl">✅</span>
                      <span>Отлично! Сегодня ты приблизился к мечте.</span>
                    </p>
                  )}
                  {dreamProgressScore >= 4 && dreamProgressScore < 7 && (
                    <p className="flex items-center gap-2">
                      <span className="text-xl">⚠️</span>
                      <span>Неплохо, но можешь лучше. День частично работает на мечту.</span>
                    </p>
                  )}
                  {dreamProgressScore < 4 && (
                    <p className="flex items-center gap-2">
                      <span className="text-xl">❌</span>
                      <span>День не работает на мечту. Нужно скорректировать курс.</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <a
                href="/goals"
                className="text-purple-600 hover:text-purple-700 hover:underline text-sm font-medium"
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
