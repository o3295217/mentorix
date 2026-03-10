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
  '/verify-email',
  '/onboarding',
]

export default function AuthGuard({ children }: AuthGuardProps) {
  const pathname = usePathname()
  const { loading, isAuthenticated } = useAuth()

  // Главная страница публична (показывает Landing или Dashboard в зависимости от auth)
  const isHomePage = pathname === '/'
  const isPublicPath = isHomePage || PUBLIC_PATHS.some(p => pathname?.startsWith(p))

  // На публичных страницах всегда рендерим
  if (isPublicPath) {
    return <>{children}</>
  }

  // Показываем загрузку пока проверяем авторизацию
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-400">Проверка авторизации...</div>
      </div>
    )
  }

  // Если не авторизован — не рендерим (редирект делает AuthProvider)
  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
