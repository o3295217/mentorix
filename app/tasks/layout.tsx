import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Задачи | AI Effectiveness Assistant',
  description: 'Управление открытыми и закрытыми задачами',
}

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return children
}
