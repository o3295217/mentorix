import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Аналитика | AI Effectiveness Assistant',
  description: 'Графики и тренды эффективности',
}

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children
}
