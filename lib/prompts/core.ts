import { UserProfile, GoalsHierarchy, DailyContext, DailyEvaluationResponse, ObservedDayRhythmContext } from './types'
import { formatHorizon } from '@/lib/dates'

// Единое правило для пользовательских AI-ответов.
// Внутренние emoji-маркеры в контексте допустимы, но модель не должна переносить их в output.
export const NO_EMOJI_OUTPUT_RULE = `ПРАВИЛО ВЫВОДА БЕЗ EMOJI:
- Не используй emoji ни в одном пользовательском текстовом поле или ответе.
- Допускаются обычная пунктуация, цифры, тире и текстовые списки.
- Внутренние emoji-маркеры из контекста и заголовков не копируй в ответ.`

// Форматирование профиля пользователя для промпта
export function formatUserProfile(profile?: UserProfile): string {
  if (!profile) return ''

  const details: string[] = []

  if (profile.name) details.push(`Имя: ${profile.name}`)
  if (profile.age) details.push(`Возраст: ${profile.age}`)
  if (profile.occupation) details.push(`Должность: ${profile.occupation}`)
  if (profile.industry) details.push(`Сфера деятельности: ${profile.industry}`)
  if (profile.teamSize) details.push(`Размер команды: ${profile.teamSize} человек`)
  if (profile.location) details.push(`Место проживания: ${profile.location}`)
  if (profile.maritalStatus) details.push(`Семейное положение: ${profile.maritalStatus}`)
  if (profile.education) details.push(`Образование: ${profile.education}`)
  if (profile.workExperience) details.push(`Опыт работы: ${profile.workExperience}`)
  if (profile.hobbies) details.push(`Хобби: ${profile.hobbies}`)
  if (profile.sports) details.push(`Спорт: ${profile.sports}`)
  if (profile.values) details.push(`Ценности: ${profile.values}`)
  if (profile.challenges) details.push(`Текущие вызовы: ${profile.challenges}`)
  if (profile.other) details.push(`Дополнительно: ${profile.other}`)

  if (details.length === 0) return ''

  return `
👤 ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ:
${details.join('\n')}

---
`
}

// Получить текстовый горизонт мечты из GoalsHierarchy
export function getDreamHorizonLabel(goals: GoalsHierarchy): string {
  const horizonMonths = goals.dreamMonths || (goals.dreamYears ? goals.dreamYears * 12 : 0)
  return horizonMonths ? formatHorizon(horizonMonths) : 'срок не указан'
}

// Форматирование иерархии целей
export function formatGoalsHierarchy(goals: GoalsHierarchy): string {
  const horizonLabel = getDreamHorizonLabel(goals)
  return `
🎯 МЕЧТА (${horizonLabel}):
${goals.dreamGoal}

📅 ЦЕЛИ НА ТЕКУЩИЙ ГОД:
${goals.yearGoals.length > 0 ? goals.yearGoals.map((g, i) => `${i + 1}. ${g}`).join('\n') : 'Не указаны'}

📆 ЦЕЛИ НА ТЕКУЩЕЕ ПОЛУГОДИЕ:
${goals.halfYearGoals.length > 0 ? goals.halfYearGoals.map((g, i) => `${i + 1}. ${g}`).join('\n') : 'Не указаны'}

📊 ЦЕЛИ НА ТЕКУЩИЙ КВАРТАЛ:
${goals.quarterGoals.length > 0 ? goals.quarterGoals.map((g, i) => `${i + 1}. ${g}`).join('\n') : 'Не указаны'}

📋 ЦЕЛИ НА ТЕКУЩИЙ МЕСЯЦ:
${goals.monthGoals.length > 0 ? goals.monthGoals.map((g, i) => `${i + 1}. ${g}`).join('\n') : 'Не указаны'}

📌 ЦЕЛИ НА ТЕКУЩУЮ НЕДЕЛЮ:
${goals.weekGoals.length > 0 ? goals.weekGoals.map((g, i) => `${i + 1}. ${g}`).join('\n') : 'Не указаны'}
`
}

// Форматирование контекста дня
export function formatDailyContext(context?: DailyContext): string {
  if (!context) return ''

  const parts: string[] = []

  if (context.emotionalState) parts.push(`Эмоциональное состояние: ${context.emotionalState}`)
  if (context.physicalState) parts.push(`Физическое состояние: ${context.physicalState}`)
  if (context.energyLevel) parts.push(`Уровень энергии: ${context.energyLevel}/10`)
  if (context.sleepQuality) parts.push(`Качество сна: ${context.sleepQuality}/10`)
  if (context.familyTime) parts.push(`Время с семьей: ${context.familyTime} минут`)
  if (context.exerciseTime) parts.push(`Время на спорт: ${context.exerciseTime} минут`)
  if (context.lifeEvents) parts.push(`Важные события: ${context.lifeEvents}`)
  if (context.externalFactors) parts.push(`Внешние факторы: ${context.externalFactors}`)

  if (parts.length === 0) return ''

  return `
🌍 КОНТЕКСТ ДНЯ:
${parts.join('\n')}

---
`
}

// Часы:минуты из минут от начала суток (1440 показываем как 24:00)
export function formatDayMinutes(minutes: number): string {
  const normalized = Math.max(0, Math.min(1440, Math.round(minutes)))
  const hours = Math.floor(normalized / 60)
  const rest = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

// Наблюдённый режим дня: персональная граница «поздно/рано» для рекомендаций.
// Секция присутствует всегда — модель должна явно знать, наблюдено окно или нет.
export function formatObservedDayRhythm(rhythm?: ObservedDayRhythmContext | null): string {
  const line = rhythm
    ? `активность примерно ${formatDayMinutes(rhythm.observedStartMinutes)}–${formatDayMinutes(rhythm.observedEndMinutes)} (по ${rhythm.sampleDays} принятым планам за ${rhythm.windowDays} дней)`
    : 'режим не наблюдён (мало данных)'

  return `
🕒 НАБЛЮДЁННЫЙ РЕЖИМ ДНЯ: ${line}

---
`
}

// Ответ когда НЕТ МЕЧТЫ
export const NO_DREAM_RESPONSE: DailyEvaluationResponse = {
  dream_progress_score: 0,
  strategic_focus_score: 0,
  productivity_score: 0,
  life_balance_score: 0,
  discipline_score: 0,
  overall_score: 0,
  plan_vs_fact: 'Невозможно проанализировать без мечты',
  alignment: {
    day_to_week: 'no - нет мечты',
    week_to_month: 'no - нет мечты',
    month_to_quarter: 'no - нет мечты',
    quarter_to_half: 'no - нет мечты',
    half_to_year: 'no - нет мечты',
    year_to_dream: 'no - нет мечты',
  },
  balance_flags: {
    health: 'critical',
    family: 'critical',
    energy: 'critical',
  },
  feedback: {
    conclusion: 'Невозможно оценить день без мечты. Ты не знаешь куда идёшь.',
    worked: '',
    blocks: 'Нет мечты — нет направления. Зайди в раздел «Цели» и заполни мечту.',
  },
  recommendations: 'Зайди в раздел «Цели» и заполни мечту. Прямо сейчас.',
}

// Ответ когда ЕСТЬ МЕЧТА, НО НЕТ ПРОМЕЖУТОЧНЫХ ЦЕЛЕЙ
export function getNoGoalsResponse(dreamGoal: string): DailyEvaluationResponse {
  return {
    dream_progress_score: 1,
    strategic_focus_score: 1,
    productivity_score: 1,
    life_balance_score: 1,
    discipline_score: 1,
    overall_score: 1,
    plan_vs_fact: 'Невозможно проанализировать без промежуточных целей',
    alignment: {
      day_to_week: 'no - нет недельных целей',
      week_to_month: 'no - нет месячных целей',
      month_to_quarter: 'no - нет квартальных целей',
      quarter_to_half: 'no - нет целей на полугодие',
      half_to_year: 'no - нет годовых целей',
      year_to_dream: 'partial - мечта есть, но нет плана',
    },
    balance_flags: {
      health: 'warning',
      family: 'warning',
      energy: 'warning',
    },
    feedback: {
      conclusion: `У тебя есть мечта: "${dreamGoal}" — но нет плана как к ней прийти.`,
      worked: 'Мечта сформулирована — это уже первый шаг.',
      blocks: 'Мечта без плана — просто фантазия. Нужно разбить её на шаги: год, квартал, месяц, неделя.',
    },
    recommendations: 'Зайди в раздел «Цели» и заполни цели на год, квартал, месяц, неделю',
  }
}
