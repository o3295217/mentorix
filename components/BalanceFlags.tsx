'use client'

interface BalanceFlagsProps {
  healthFlag?: string
  familyFlag?: string
  energyFlag?: string
}

export default function BalanceFlags({
  healthFlag,
  familyFlag,
  energyFlag,
}: BalanceFlagsProps) {
  if (!healthFlag && !familyFlag && !energyFlag) {
    return null
  }

  const getIcon = (flag?: string) => {
    switch (flag) {
      case 'ok':
        return '✅'
      case 'warning':
        return '⚠️'
      case 'critical':
        return '🔥'
      default:
        return '❓'
    }
  }

  const getColor = (flag?: string) => {
    switch (flag) {
      case 'ok':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getText = (flag?: string) => {
    switch (flag) {
      case 'ok':
        return 'В порядке'
      case 'warning':
        return 'Требует внимания'
      case 'critical':
        return 'Критическая ситуация!'
      default:
        return 'Неизвестно'
    }
  }

  const hasCritical = healthFlag === 'critical' || familyFlag === 'critical' || energyFlag === 'critical'
  const hasWarning = healthFlag === 'warning' || familyFlag === 'warning' || energyFlag === 'warning'

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">⚖️ Баланс жизни</h2>

      {hasCritical && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4">
          <p className="text-red-900 font-bold">
            🔥 ВНИМАНИЕ! Есть критические зоны - это угроза для достижения мечты!
          </p>
          <p className="text-red-700 text-sm mt-1">
            Нельзя дойти к мечте выгоревшим, больным или с разрушенными отношениями.
          </p>
        </div>
      )}

      {!hasCritical && hasWarning && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-4">
          <p className="text-yellow-900 font-semibold">
            ⚠️ Некоторые сферы требуют внимания
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {healthFlag && (
          <div className={`p-4 rounded-lg border-2 ${getColor(healthFlag)}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{getIcon(healthFlag)}</span>
              <h3 className="font-semibold">Здоровье</h3>
            </div>
            <p className="text-sm">{getText(healthFlag)}</p>
          </div>
        )}

        {familyFlag && (
          <div className={`p-4 rounded-lg border-2 ${getColor(familyFlag)}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{getIcon(familyFlag)}</span>
              <h3 className="font-semibold">Семья</h3>
            </div>
            <p className="text-sm">{getText(familyFlag)}</p>
          </div>
        )}

        {energyFlag && (
          <div className={`p-4 rounded-lg border-2 ${getColor(energyFlag)}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{getIcon(energyFlag)}</span>
              <h3 className="font-semibold">Энергия</h3>
            </div>
            <p className="text-sm">{getText(energyFlag)}</p>
          </div>
        )}
      </div>
    </div>
  )
}
