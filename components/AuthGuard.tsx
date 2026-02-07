'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'

interface AuthGuardProps {
  children: React.ReactNode
}

// Публичные пути, не требующие авторизации
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
]

export default function AuthGuard({ children }: AuthGuardProps) {
  const pathname = usePathname()
  const { loading, isAuthenticated } = useAuth()

  const isPublicPath = PUBLIC_PATHS.some(p => pathname?.startsWith(p))

  // На публичных страницах всегда рендерим
  if (isPublicPath) {
    return <>{children}</>
  }

  // Показываем загрузку пока проверяем авторизацию
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-600 dark:text-gray-400">Проверка авторизации...</div>
      </div>
    )
  }

  // Если не авторизован — не рендерим (редирект делает AuthProvider)
  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
