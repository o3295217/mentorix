// Синхронизация выбранной даты плана дня между закреплённым селектором
// в шапке (Navigation) и страницей /daily — через localStorage + событие окна.

export const DAILY_DATE_STORAGE_KEY = 'daily:selectedDate'
const DAILY_DATE_EVENT = 'daily:selected-date-changed'

export const isDateKey = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value)

export function writeStoredDailyDate(date: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DAILY_DATE_STORAGE_KEY, date)
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent<string>(DAILY_DATE_EVENT, { detail: date }))
}

export function subscribeDailyDate(onChange: (date: string) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (event: Event) => {
    const date = (event as CustomEvent<string>).detail
    if (typeof date === 'string' && isDateKey(date)) onChange(date)
  }
  window.addEventListener(DAILY_DATE_EVENT, handler)
  return () => window.removeEventListener(DAILY_DATE_EVENT, handler)
}
