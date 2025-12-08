import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Периоды | AI Effectiveness Assistant',
  description: 'Оценка периодов: неделя, месяц, квартал, год',
}

export default function PeriodsLayout({ children }: { children: React.ReactNode }) {
  return children
}
