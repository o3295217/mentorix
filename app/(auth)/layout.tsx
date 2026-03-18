import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AION - Вход',
  description: 'Вход в систему',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children
}
