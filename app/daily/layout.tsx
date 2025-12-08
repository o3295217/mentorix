import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ежедневник | AI Effectiveness Assistant',
  description: 'Планирование дня и фиксация результатов',
}

export default function DailyLayout({ children }: { children: React.ReactNode }) {
  return children
}
