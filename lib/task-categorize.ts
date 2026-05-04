export type TaskCategory = 'привычки' | 'созвоны' | 'стратегические' | 'операционные'

const HABIT_TIME_PATTERN = /^\d{1,2}:\d{2}/

export function getTaskCategory(text: string): TaskCategory {
  const lower = text.toLowerCase()

  if (
    lower.includes('подъём') ||
    lower.includes('подъем') ||
    lower.includes('зарядка') ||
    lower.includes('душ') ||
    lower.includes('начало работы') ||
    HABIT_TIME_PATTERN.test(lower)
  ) {
    return 'привычки'
  }

  if (
    lower.includes('оперативка') ||
    lower.includes('созвон') ||
    lower.includes('встреча') ||
    lower.includes('звонок')
  ) {
    return 'созвоны'
  }

  if (
    lower.includes('стратег') ||
    lower.includes('бюджет') ||
    lower.includes('планирование') ||
    lower.includes('анализ') ||
    lower.includes('разработка') ||
    lower.includes('проект')
  ) {
    return 'стратегические'
  }

  return 'операционные'
}

export const getTaskType = getTaskCategory