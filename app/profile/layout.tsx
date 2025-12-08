import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Профиль | AI Effectiveness Assistant',
  description: 'Настройка профиля пользователя для персонализированных рекомендаций',
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children
}
