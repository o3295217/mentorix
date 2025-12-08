import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Цели | AI Effectiveness Assistant',
  description: 'Управление целями: мечта, год, квартал, месяц, неделя',
}

export default function GoalsLayout({ children }: { children: React.ReactNode }) {
  return children
}
