import {
  PeriodEvaluationRequest,
  DayData,
} from './types'
import { formatUserProfile } from './core'

// Определение типа периода на основе длительности
export function determinePeriodTemplate(
  periodStart: Date,
  periodEnd: Date
): 'week' | 'month' | 'quarter' | 'year' {
  const days = Math.ceil(
    (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (days <= 7) return 'week'
  if (days <= 30) return 'month'
  if (days <= 90) return 'quarter'
  return 'year'
}

// Форматирование данных дней для промпта (ОПТИМИЗИРОВАННАЯ ВЕРСИЯ - только оценки)
function formatDaysData(days: DayData[]): string {
  return days
    .map((day, index) => {
      const flags = []
      if (day.healthFlag) flags.push(`Здоровье: ${day.healthFlag}`)
      if (day.familyFlag) flags.push(`Семья: ${day.familyFlag}`)
      if (day.energyFlag) flags.push(`Энергия: ${day.energyFlag}`)

      return `День ${index + 1} (${day.date}): Dream ${day.dreamProgressScore}/10, Overall ${day.overallScore}/10 | Strategy ${day.strategyScore}/10, Ops ${day.operationsScore}/10, Team ${day.teamScore}/10, Eff ${day.efficiencyScore}/10${flags.length > 0 ? ' | ' + flags.join(', ') : ''}`
    })
    .join('\n')
}

// Построение промпта для периодической оценки
export function buildPeriodEvaluationPrompt(
  request: PeriodEvaluationRequest
): string {
  const userProfileSection = formatUserProfile(request.userProfile)
  const daysData = formatDaysData(request.days)

  const template = determinePeriodTemplate(
    new Date(request.periodStart),
    new Date(request.periodEnd)
  )

  const instructionsMap = {
    week: 'НЕДЕЛЬНАЯ ОЦЕНКА',
    month: 'МЕСЯЧНАЯ ОЦЕНКА',
    quarter: 'КВАРТАЛЬНАЯ ОЦЕНКА',
    year: 'ГОДОВАЯ ОЦЕНКА',
  }

  return `Ты строгий ИИ-коуч. Твоя задача - дать ${instructionsMap[template]} периода.

${userProfileSection}

🌟 МЕЧТА ПОЛЬЗОВАТЕЛЯ (5 лет):
${request.goals.dreamGoal}

ЦЕЛИ ПО ПЕРИОДАМ:
Год: ${request.goals.yearGoals.length > 0 ? request.goals.yearGoals.join(', ') : 'Не указаны'}
${template === 'year' ? '' : `Квартал: ${request.goals.quarterGoals.length > 0 ? request.goals.quarterGoals.join(', ') : 'Не указаны'}`}
${template === 'week' || template === 'month' ? `Месяц: ${request.goals.monthGoals.length > 0 ? request.goals.monthGoals.join(', ') : 'Не указаны'}` : ''}
${template === 'week' ? `Неделя: ${request.goals.weekGoals.length > 0 ? request.goals.weekGoals.join(', ') : 'Не указаны'}` : ''}

---

📊 ДАННЫЕ ПЕРИОДА: ${request.periodStart} - ${request.periodEnd}
Всего дней с данными: ${request.days.length}

${daysData}

---

ИНСТРУКЦИИ ДЛЯ ${instructionsMap[template].toUpperCase()}:

1. РАССЧИТАЙ СРЕДНИЕ ПОКАЗАТЕЛИ:
   - Средний dreamProgressScore
   - Средний overallScore
   - Средние по каждому показателю (strategy, operations, team, efficiency)

2. АНАЛИЗ ПРОФЕССИОНАЛЬНОГО БЛОКА:
   - Стратегическое развитие (средний strategyScore)
   - Операционное управление (средний operationsScore)
   - Работа с командой (средний teamScore)
   - Общий анализ: что работало, что нет

3. АНАЛИЗ ЛИЧНОГО БЛОКА:
   - Здоровье: анализ healthFlag, сон, энергия (оценка 1-10)
   - Семья: анализ familyFlag, время с близкими (оценка 1-10)
   - Энергия: анализ energyFlag, восстановление (оценка 1-10)
   - Что угрожает балансу

4. АНАЛИЗ СОЦИАЛЬНОГО БЛОКА:
   - Командная работа (оценка 1-10)
   - Делегирование, развитие людей

5. БАЛАНС И РИСКИ:
   - Work-Life Balance (оценка 1-10)
   - Риск выгорания: низкий/средний/высокий/критичный
   - Что нужно корректировать

6. ПАТТЕРНЫ ПОВЕДЕНИЯ:
   - Лучшие дни (по дням недели или датам)
   - Худшие дни
   - Паттерн продуктивности (описание)
   - Проблемы с балансом

7. ТРЕНДЫ:
   - Dream Progress: растет/стабильно/падает
   - Overall: растет/стабильно/падает
   - Strategy: растет/стабильно/падает
   - Описание трендов

8. ВЫПОЛНЕНИЕ ЦЕЛЕЙ ПЕРИОДА:
   - Сколько всего целей было
   - Сколько выполнено (анализируй план/факт)
   - Сколько в процессе
   - Сколько не начато
   - % выполнения
   - Анализ: почему выполнено/не выполнено

9. ALIGNMENT (вертикальный):
   - Работают ли дни на цели периода
   - Работает ли период на долгосрочные цели
   - Работает ли все на мечту

10. БЛОКЕРЫ (опционально):
    - Стратегические блокеры
    - Операционные блокеры
    - Личные блокеры (здоровье, энергия)

11. ОБРАТНАЯ СВЯЗЬ (3-4 абзаца):
    - Честно и жестко
    - Фокус: движение к мечте за период
    - Что удалось, что провалилось
    - Главные проблемы

12. РЕКОМЕНДАЦИИ НА СЛЕДУЮЩИЙ ПЕРИОД:
    - 3-5 конкретных рекомендаций
    - Что изменить
    - На чем сфокусироваться

13. ИНСАЙТЫ (для долгосрочных периодов):
    - Глубокие выводы
    - Паттерны, которые не видны в коротких периодах

ФОРМАТ ОТВЕТА - СТРОГО JSON:
{
  "dreamProgressScore": число (среднее),
  "overallScore": число (среднее),
  "professionalBlock": {
    "strategyAvg": число,
    "operationsAvg": число,
    "teamAvg": число,
    "analysis": "анализ профессионального блока"
  },
  "personalBlock": {
    "healthScore": число 1-10,
    "familyScore": число 1-10,
    "energyScore": число 1-10,
    "analysis": "анализ личного блока"
  },
  "socialBlock": {
    "teamworkScore": число 1-10,
    "analysis": "анализ социального блока"
  },
  "balanceBlock": {
    "workLifeBalance": число 1-10,
    "riskOfBurnout": "низкий/средний/высокий/критичный",
    "analysis": "анализ баланса"
  },
  "patterns": {
    "bestDays": ["день1", "день2"],
    "worstDays": ["день1", "день2"],
    "productivityPattern": "описание паттерна",
    "balanceIssues": ["проблема1", "проблема2"]
  },
  "trends": {
    "dreamProgressTrend": "растет/стабильно/падает",
    "overallTrend": "растет/стабильно/падает",
    "strategyTrend": "растет/стабильно/падает",
    "description": "описание трендов"
  },
  "goalsCompletion": {
    "totalGoals": число,
    "completedGoals": число,
    "inProgressGoals": число,
    "notStartedGoals": число,
    "completionRate": число %,
    "analysis": "анализ выполнения целей"
  },
  "alignment": "детальный анализ alignment",
  "blockers": {
    "strategic": ["блокер1", "блокер2"],
    "operational": ["блокер1"],
    "personal": ["блокер1"]
  },
  "feedback": "обратная связь 3-4 абзаца",
  "recommendations": "конкретные рекомендации на следующий период",
  "insights": "глубокие инсайты (опционально, для долгих периодов)"
}

КРИТИЧЕСКИ ВАЖНО:
- Анализируй ВЕСЬ период целиком, а не отдельные дни
- Ищи паттерны и тренды
- Будь честным и жестким
- Фокус на движении к мечте
- Баланс важен - выгорание убьет мечту
`
}
