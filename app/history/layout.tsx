import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'История | AI Effectiveness Assistant',
  description: 'История ежедневных записей и оценок',
}

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return children
}
