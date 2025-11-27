'use client'

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
      <div className="flex items-start gap-4">
        <div className="text-4xl">🌟</div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Твоя мечта (5 лет):</h2>
          <p className="text-lg text-gray-800 mb-4 italic">"{dreamGoal}"</p>

          {showDetails && dreamProgressScore !== undefined && (
            <div className="mt-4">
              <div
                className={`inline-flex items-center gap-3 px-6 py-3 rounded-lg border-2 ${scoreColorClasses[scoreColor]}`}
              >
                <span className="text-sm font-semibold">Сегодняшний прогресс к мечте:</span>
                <span className="text-3xl font-bold">{dreamProgressScore}</span>
                <span className="text-sm">/10</span>
              </div>

              <div className="mt-4 text-sm text-gray-600">
                {dreamProgressScore >= 7 && (
                  <p>✅ Отлично! Сегодня ты приблизился к мечте.</p>
                )}
                {dreamProgressScore >= 4 && dreamProgressScore < 7 && (
                  <p>⚠️ Неплохо, но можешь лучше. День частично работает на мечту.</p>
                )}
                {dreamProgressScore < 4 && (
                  <p>❌ День не работает на мечту. Нужно скорректировать курс.</p>
                )}
              </div>
            </div>
          )}

          {!showDetails && (
            <div className="mt-2">
              <a href="/goals" className="text-purple-600 hover:underline text-sm">
                Редактировать мечту и цели →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
