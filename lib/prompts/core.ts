import { UserProfile, GoalsHierarchy, DailyContext, DailyEvaluationResponse } from './types'
import { formatHorizon } from '@/lib/dates'

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

// Форматирование иерархии целей
export function formatGoalsHierarchy(goals: GoalsHierarchy): string {
  const horizonMonths = goals.dreamMonths || (goals.dreamYears ? goals.dreamYears * 12 : 0)
  const horizonLabel = horizonMonths ? formatHorizon(horizonMonths) : 'срок не указан'
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
    health: 'критично',
    family: 'критично',
    energy: 'критично',
  },
  feedback: {
    conclusion: 'Невозможно оценить день без мечты. Ты не знаешь куда идёшь.',
    worked: '',
    blocks: 'Нет мечты — нет направления. Зайди в раздел «Цели» и заполни мечту на 5 лет.',
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
      health: 'внимание',
      family: 'внимание',
      energy: 'внимание',
    },
    feedback: {
      conclusion: `У тебя есть мечта: "${dreamGoal}" — но нет плана как к ней прийти.`,
      worked: 'Мечта сформулирована — это уже первый шаг.',
      blocks: 'Мечта без плана — просто фантазия. Нужно разбить её на шаги: год, квартал, месяц, неделя.',
    },
    recommendations: 'Зайди в раздел «Цели» и заполни цели на год, квартал, месяц, неделю',
  }
}
