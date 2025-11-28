import {
  ForecastRequest,
  ForecastResponse,
  DayData,
} from './types'
import { formatUserProfile } from './core'

// Вычисление текущего темпа прогресса
function calculateCurrentPace(days: DayData[]): {
  avgDreamProgress: number
  avgOverall: number
  trend: 'растет' | 'стабильно' | 'падает'
} {
  if (days.length === 0) {
    return { avgDreamProgress: 0, avgOverall: 0, trend: 'стабильно' }
  }

  const avgDreamProgress =
    days.reduce((sum, d) => sum + d.dreamProgressScore, 0) / days.length
  const avgOverall = days.reduce((sum, d) => sum + d.overallScore, 0) / days.length

  // Определение тренда: сравниваем первую и вторую половину периода
  const midpoint = Math.floor(days.length / 2)
  const firstHalfAvg =
    days.slice(0, midpoint).reduce((sum, d) => sum + d.dreamProgressScore, 0) / midpoint
  const secondHalfAvg =
    days.slice(midpoint).reduce((sum, d) => sum + d.dreamProgressScore, 0) /
    (days.length - midpoint)

  let trend: 'растет' | 'стабильно' | 'падает' = 'стабильно'
  if (secondHalfAvg > firstHalfAvg + 0.5) trend = 'растет'
  else if (secondHalfAvg < firstHalfAvg - 0.5) trend = 'падает'

  return { avgDreamProgress, avgOverall, trend }
}

// Форматирование исторических данных для промпта
function formatHistoricalData(days: DayData[]): string {
  const pace = calculateCurrentPace(days)

  return `
📊 ИСТОРИЧЕСКИЕ ДАННЫЕ (последние ${days.length} дней):

Средние показатели:
- Dream Progress: ${pace.avgDreamProgress.toFixed(1)}/10
- Overall Score: ${pace.avgOverall.toFixed(1)}/10
- Тренд: ${pace.trend}

Последние 10 дней:
${days
  .slice(-10)
  .map(
    (d, i) => `
День ${i + 1} (${d.date}): Dream Progress ${d.dreamProgressScore}/10, Overall ${d.overallScore}/10
План: ${d.planText.substring(0, 100)}...
Факт: ${d.factText.substring(0, 100)}...
`
  )
  .join('\n')}
`
}

// Построение промпта для прогноза
export function buildForecastPrompt(request: ForecastRequest): string {
  const userProfileSection = formatUserProfile(request.userProfile)
  const historicalData = formatHistoricalData(request.historicalDays)
  const pace = calculateCurrentPace(request.historicalDays)

  return `Ты строгий ИИ-коуч и аналитик. Твоя задача - дать ЧЕСТНЫЙ ПРОГНОЗ движения пользователя к его мечте.

${userProfileSection}

🌟 МЕЧТА ПОЛЬЗОВАТЕЛЯ (${request.dreamYears} лет):
${request.dreamGoal}

${request.currentPeriodGoals && request.currentPeriodGoals.length > 0 ? `
🎯 ЦЕЛИ ТЕКУЩЕГО ПЕРИОДА (${request.periodType || 'период'}):
${request.currentPeriodGoals.join('\n')}
` : ''}

${historicalData}

---

ИНСТРУКЦИИ ДЛЯ ПРОГНОЗА:

ТИП ПРОГНОЗА: ${request.forecastType === 'current_period' ? 'Прогноз текущего периода' : request.forecastType === 'dream_achievement' ? 'Прогноз достижения мечты' : 'Комплексный прогноз'}

${request.forecastType === 'current_period' || request.forecastType === 'comprehensive' ? `
1. ПРОГНОЗ ВЫПОЛНЕНИЯ ЦЕЛЕЙ ТЕКУЩЕГО ПЕРИОДА:
   - Проанализируй текущий темп (Dream Progress: ${pace.avgDreamProgress.toFixed(1)}/10, тренд: ${pace.trend})
   - Оцени вероятность выполнения ВСЕХ целей периода (0-100%)
   - Рассчитай ожидаемый % выполнения (сколько целей реально будет выполнено)
   - Определи текущий темп: отстает/в темпе/опережает
   - Дай 3-5 конкретных рекомендаций для улучшения результата
` : ''}

${request.forecastType === 'dream_achievement' || request.forecastType === 'comprehensive' ? `
2. ПРОГНОЗ ДОСТИЖЕНИЯ МЕЧТЫ:
   - При текущем темпе (Dream Progress: ${pace.avgDreamProgress.toFixed(1)}/10): сколько лет до мечты?
   - Идет ли по плану? (план: ${request.dreamYears} лет)
   - Рассчитай % прогресса в год при текущем темпе
   - Что нужно изменить, чтобы достичь мечты за ${request.dreamYears} лет?
   - Будь честным: если темп слабый - скажи прямо
` : ''}

3. "ЧТО ЕСЛИ" СЦЕНАРИИ (3-5 сценариев):
   - Если увеличить Dream Progress на 20% → какое влияние?
   - Если продолжать в текущем темпе → что произойдет?
   - Если упадет в баланс (здоровье/семья) → какие риски?
   - Если улучшить strategyScore → как повлияет на мечту?
   - Если появится блокер (болезнь, кризис) → насколько отстанет?

   Для каждого сценария:
   - Описание сценария
   - Влияние на достижение мечты
   - Вероятность: низкая/средняя/высокая

4. КЛЮЧЕВЫЕ РЕКОМЕНДАЦИИ (3-5 главных):
   - Фокус на конкретных действиях
   - Что делать ЗАВТРА, чтобы приблизиться к мечте
   - На чем сфокусироваться в ближайший период
   - Что изменить в подходе
   - Какие риски предотвратить

5. КРАТКОЕ РЕЗЮМЕ ПРОГНОЗА (2-3 абзаца):
   - Честная оценка текущей ситуации
   - Реалистичен ли план достижения мечты
   - Главные выводы и предупреждения
   - Мотивация (если заслужена) или жесткая критика (если нужна)

ФОРМАТ ОТВЕТА - СТРОГО JSON:
{
  ${request.forecastType === 'current_period' || request.forecastType === 'comprehensive' ? `
  "currentPeriodForecast": {
    "periodType": "${request.periodType || 'период'}",
    "completionProbability": число 0-100 (% вероятность выполнения всех целей),
    "expectedCompletionRate": число 0-100 (% ожидаемое выполнение),
    "daysRemaining": число (оставшихся дней в периоде, примерная оценка),
    "currentPace": "отстает/в темпе/опережает",
    "recommendations": ["рекомендация1", "рекомендация2", ...]
  },
  ` : ''}
  "dreamForecast": {
    "estimatedYears": число (сколько лет до мечты при текущем темпе),
    "onTrack": true/false (идет ли по плану - в пределах ${request.dreamYears} лет),
    "dreamProgressRate": число (% прогресса в год при текущем темпе),
    "adjustmentNeeded": "что нужно изменить для достижения мечты за ${request.dreamYears} лет"
  },
  "whatIfScenarios": [
    {
      "scenario": "Если увеличить Dream Progress на 20%",
      "impact": "Детальное описание влияния на достижение мечты",
      "probability": "низкая/средняя/высокая"
    },
    {
      "scenario": "Если продолжать в текущем темпе",
      "impact": "Что произойдет",
      "probability": "средняя/высокая"
    }
    // ... еще 2-3 сценария
  ],
  "keyRecommendations": [
    "Конкретная рекомендация 1",
    "Конкретная рекомендация 2",
    "Конкретная рекомендация 3"
  ],
  "summary": "Краткое резюме прогноза (2-3 абзаца): честная оценка ситуации, реалистичность плана, главные выводы"
}

КРИТИЧЕСКИ ВАЖНО:
- Будь ЧЕСТНЫМ: если темп слабый - скажи прямо, не приукрашивай
- Основывайся на ДАННЫХ: средний Dream Progress ${pace.avgDreamProgress.toFixed(1)}/10, тренд ${pace.trend}
- Прогноз должен быть РЕАЛИСТИЧНЫМ: если при текущем темпе мечта недостижима за ${request.dreamYears} лет - скажи сколько реально нужно
- Рекомендации должны быть КОНКРЕТНЫМИ и ДЕЙСТВЕННЫМИ
- Сценарии "что если" должны быть ПРАКТИЧНЫМИ и ВЕРОЯТНЫМИ
- Если тренд падает - предупреди о рисках ЖЕСТКО
- Если тренд растет - похвали, но напомни о балансе и устойчивости`
}
