import {
  ForecastRequest,
  DayDataFull,
  ExecutionQuality,
} from './types'
import { formatUserProfile, NO_EMOJI_OUTPUT_RULE } from './core'
import { formatHorizon } from '@/lib/dates'

// Расчет качества выполнения за базовый период
export function calculateExecutionQuality(days: DayDataFull[]): ExecutionQuality {
  if (days.length === 0) {
    return {
      totalTasksPlanned: 0,
      totalTasksCompleted: 0,
      completionRate: 0,
      strategicTasksPlanned: 0,
      strategicTasksCompleted: 0,
      strategicCompletionRate: 0,
      avgDreamProgress: 0,
      avgOverallScore: 0,
      trend: 'стабильно',
      patterns: [],
    }
  }

  const totalTasksPlanned = days.reduce((sum, d) => sum + d.tasksPlanned, 0)
  const totalTasksCompleted = days.reduce((sum, d) => sum + d.tasksCompleted, 0)
  const strategicTasksPlanned = days.reduce((sum, d) => sum + d.strategicTasks, 0)
  const strategicTasksCompleted = days.reduce((sum, d) => sum + d.strategicCompleted, 0)

  const completionRate = totalTasksPlanned > 0 
    ? Math.round((totalTasksCompleted / totalTasksPlanned) * 100) 
    : 0
  const strategicCompletionRate = strategicTasksPlanned > 0 
    ? Math.round((strategicTasksCompleted / strategicTasksPlanned) * 100) 
    : 0

  const avgDreamProgress = days.reduce((sum, d) => sum + d.dreamProgressScore, 0) / days.length
  const avgOverallScore = days.reduce((sum, d) => sum + d.overallScore, 0) / days.length

  // Определение тренда
  const midpoint = Math.floor(days.length / 2)
  if (midpoint === 0) {
    return {
      totalTasksPlanned,
      totalTasksCompleted,
      completionRate,
      strategicTasksPlanned,
      strategicTasksCompleted,
      strategicCompletionRate,
      avgDreamProgress,
      avgOverallScore,
      trend: 'стабильно',
      patterns: [],
    }
  }

  const firstHalfAvg = days.slice(0, midpoint).reduce((sum, d) => sum + d.dreamProgressScore, 0) / midpoint
  const secondHalfAvg = days.slice(midpoint).reduce((sum, d) => sum + d.dreamProgressScore, 0) / (days.length - midpoint)

  let trend: 'растет' | 'стабильно' | 'падает' = 'стабильно'
  if (secondHalfAvg > firstHalfAvg + 0.5) trend = 'растет'
  else if (secondHalfAvg < firstHalfAvg - 0.5) trend = 'падает'

  return {
    totalTasksPlanned,
    totalTasksCompleted,
    completionRate,
    strategicTasksPlanned,
    strategicTasksCompleted,
    strategicCompletionRate,
    avgDreamProgress,
    avgOverallScore,
    trend,
    patterns: [], // ИИ заполнит
  }
}

// Слияние рассчитанных в коде чисел с паттернами, которые вернула модель.
// Числовые показатели (totalTasksPlanned, completionRate и т.д.) всегда берутся
// из серверного расчета — модель присылает только "patterns", чтобы не тратить
// output-токены и не рисковать расхождением чисел.
export function mergeExecutionQuality(
  computed: ExecutionQuality,
  modelPatterns: unknown
): ExecutionQuality {
  const patterns = Array.isArray(modelPatterns)
    ? modelPatterns.filter((p): p is string => typeof p === 'string')
    : []

  return {
    ...computed,
    patterns,
  }
}

// Форматирование данных базового периода
function formatBasePeriodData(days: DayDataFull[], quality: ExecutionQuality): string {
  return `
📊 БАЗА ДЛЯ АНАЛИЗА (${days.length} дней):

КАЧЕСТВО ВЫПОЛНЕНИЯ:
- Всего задач запланировано: ${quality.totalTasksPlanned}
- Выполнено: ${quality.totalTasksCompleted} (${quality.completionRate}%)
- Стратегических задач: ${quality.strategicTasksPlanned}
- Выполнено стратегических: ${quality.strategicTasksCompleted} (${quality.strategicCompletionRate}%)

ОЦЕНКИ:
- Средний Dream Progress: ${quality.avgDreamProgress.toFixed(1)}/10
- Средний Overall Score: ${quality.avgOverallScore.toFixed(1)}/10
- Тренд: ${quality.trend}

ДЕТАЛИ ПО ДНЯМ:
${days.map((d, i) => `
День ${i + 1} (${d.date}):
  План: ${d.planText.substring(0, 200)}${d.planText.length > 200 ? '...' : ''}
  Факт: ${d.factText.substring(0, 200)}${d.factText.length > 200 ? '...' : ''}
  Задачи: ${d.tasksCompleted}/${d.tasksPlanned} выполнено (стратегических: ${d.strategicCompleted}/${d.strategicTasks})
  Оценки: Dream ${d.dreamProgressScore}/10, Overall ${d.overallScore}/10
`).join('\n')}
`
}

// Построение промпта для прогноза (НОВАЯ ЛОГИКА)
export function buildForecastPrompt(request: ForecastRequest): string {
  const userProfileSection = formatUserProfile(request.userProfile)
  const quality = calculateExecutionQuality(request.baseDays)
  const baseData = formatBasePeriodData(request.baseDays, quality)

  const horizonNames: Record<string, string> = {
    week: 'Неделя',
    month: 'Месяц',
    quarter: 'Квартал',
    year: 'Год',
    dream: 'Мечта',
  }

  const horizonName = horizonNames[request.forecastHorizon] || request.forecastHorizon

  return `Ты строгий ИИ-коуч и аналитик. Твоя задача - дать ЧЕСТНЫЙ ПРОГНОЗ на основе РЕАЛЬНОГО качества выполнения задач.

${userProfileSection}

🌟 МЕЧТА ПОЛЬЗОВАТЕЛЯ${request.dreamMonths ? ` (${formatHorizon(request.dreamMonths)})` : ''}:
${request.dreamGoal}

---

${baseData}

---

🎯 ГОРИЗОНТ ПРОГНОЗА: ${horizonName}
${request.horizonStart && request.horizonEnd ? `Период: ${request.horizonStart} — ${request.horizonEnd}` : ''}

ЦЕЛИ ГОРИЗОНТА:
${request.horizonGoals.length > 0 
  ? request.horizonGoals.map((g, i) => `${i + 1}. ${g}`).join('\n')
  : 'Цели не указаны'}

---

ИНСТРУКЦИИ ДЛЯ ПРОГНОЗА:

${NO_EMOJI_OUTPUT_RULE}

1. АНАЛИЗ КАЧЕСТВА ВЫПОЛНЕНИЯ (базовый период):
   - Проанализируй План vs Факт каждого дня
   - Выяви паттерны: когда срывается план? какие задачи не выполняются?
   - Оцени качество стратегических задач vs операционных
   - Найди закономерности: дни недели, типы задач, время
   - КОНКРЕТНО: что работает, что нет

2. ПРОГНОЗ ПО КАЖДОЙ ЦЕЛИ ГОРИЗОНТА:
   Для каждой цели из списка выше:
   - Вероятность выполнения (0-100%)
   - Уровень риска: низкий/средний/высокий
   - Что угрожает выполнению (конкретные факторы из анализа)
   - Рекомендация по этой цели

3. ПРОГНОЗ ДОСТИЖЕНИЯ МЕЧТЫ:
   При текущем качестве выполнения (${quality.completionRate}% задач, ${quality.strategicCompletionRate}% стратегических):
   - Сколько лет до мечты реально?
   - Идет ли по плану${request.dreamMonths ? ` (${formatHorizon(request.dreamMonths)})` : ''}?
   - Какой % прогресса в год при текущем темпе?
   - Какой % нужен для достижения вовремя?
   - Что конкретно нужно изменить?

4. ПАТТЕРНЫ ПОВЕДЕНИЯ (3-5 паттернов, в executionQuality.patterns):
   На основе анализа план/факт:
   - Позитивные паттерны (что работает)
   - Негативные паттерны (что мешает)
   - Рекомендации по каждому
   ВАЖНО: числовые показатели (totalTasksPlanned, completionRate, avgDreamProgress и т.д.)
   уже рассчитаны в коде — НЕ включай их в ответ, верни только текстовые паттерны.

5. СЦЕНАРИИ "ЧТО ЕСЛИ" (3-5):
   - Если улучшить выполнение стратегических задач до 80%
   - Если продолжать в текущем темпе
   - Если выполнение упадет еще на 20%
   - Если сфокусироваться на 1-2 ключевых целях
   - Конкретный сценарий под эту ситуацию

6. КРИТИЧЕСКИЕ РИСКИ (если есть):
   - Что может сорвать достижение целей?
   - На что обратить внимание СРОЧНО?

7. КЛЮЧЕВЫЕ РЕКОМЕНДАЦИИ (3-5):
   - КОНКРЕТНЫЕ действия
   - Что делать ЗАВТРА
   - Что изменить в подходе к планированию
   - Как улучшить выполнение стратегических задач

ФОРМАТ ОТВЕТА - СТРОГО JSON:
{
  "executionQuality": {
    "patterns": ["паттерн 1 из анализа", "паттерн 2", ...]
  },
  "behaviorPatterns": [
    {
      "pattern": "Описание паттерна",
      "impact": "позитивный/негативный/нейтральный",
      "recommendation": "Что делать"
    }
  ],
  "horizonType": "${horizonName}",
  "goalForecasts": [
    {
      "goal": "Текст цели",
      "probability": число 0-100,
      "risk": "низкий/средний/высокий",
      "threats": ["угроза 1", "угроза 2"],
      "recommendation": "Что делать для этой цели"
    }
  ],
  "overallProbability": число 0-100 (общая вероятность выполнить все цели горизонта),
  "dreamForecast": {
    "estimatedYears": число (реальный срок при текущем темпе),
    "onTrack": true/false,
    "progressPerYear": число (% в год при текущем темпе),
    "requiredProgressPerYear": число (% нужно для достижения${request.dreamMonths ? ` за ${formatHorizon(request.dreamMonths)}` : ''}),
    "gap": число (разрыв между текущим и требуемым),
    "adjustmentNeeded": "Что конкретно изменить"
  },
  "whatIfScenarios": [
    {
      "scenario": "Описание сценария",
      "impact": "Влияние на цели и мечту",
      "probability": "низкая/средняя/высокая"
    }
  ],
  "keyRecommendations": [
    "Конкретная рекомендация 1",
    "Конкретная рекомендация 2"
  ],
  "criticalRisks": [
    "Риск 1 (если есть)",
    "Риск 2"
  ],
  "summary": "2-3 абзаца: честная оценка на основе анализа план/факт, прогноз по целям, что делать"
}

КРИТИЧЕСКИ ВАЖНО:
- Анализируй РЕАЛЬНЫЕ данные план/факт, не абстрактные скоры
- Прогноз по КАЖДОЙ цели горизонта отдельно
- Паттерны из КОНКРЕТНЫХ примеров (дни, задачи)
- Если ${quality.completionRate}% выполнения - это мало, скажи прямо
- Если ${quality.strategicCompletionRate}% стратегических - это проблема, укажи
- Рекомендации должны быть ДЕЙСТВЕННЫМИ и КОНКРЕТНЫМИ
- Не приукрашивай: если темп слабый - говори как есть`
}
