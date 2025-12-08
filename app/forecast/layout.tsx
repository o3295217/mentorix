import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Прогноз | AI Effectiveness Assistant',
  description: 'ИИ-прогноз достижения целей и мечты',
}

export default function ForecastLayout({ children }: { children: React.ReactNode }) {
  return children
}
