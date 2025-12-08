import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Прогресс | AI Effectiveness Assistant',
  description: 'Отслеживание прогресса и достижений',
}

export default function ProgressLayout({ children }: { children: React.ReactNode }) {
  return children
}
