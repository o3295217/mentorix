'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

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
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Проверяем, является ли текущий путь публичным
  const isPublicPath = PUBLIC_PATHS.some(p => pathname?.startsWith(p))

  useEffect(() => {
    // Для публичных страниц не проверяем авторизацию
    if (isPublicPath) {
      setIsChecking(false)
      setIsAuthenticated(true) // Разрешаем рендер
      return
    }

    checkAuth()
  }, [pathname, isPublicPath])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      
      if (res.status === 401) {
        setIsAuthenticated(false)
        router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`)
        return
      }

      if (res.ok) {
        setIsAuthenticated(true)
      }
    } catch (error) {
      console.error('Auth check error:', error)
      setIsAuthenticated(false)
      router.push('/login')
    } finally {
      setIsChecking(false)
    }
  }

  // Показываем загрузку пока проверяем авторизацию
  if (isChecking && !isPublicPath) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-600 dark:text-gray-400">Проверка авторизации...</div>
      </div>
    )
  }

  // Если не авторизован и не на публичной странице - не рендерим
  if (!isAuthenticated && !isPublicPath) {
    return null
  }

  return <>{children}</>
}
