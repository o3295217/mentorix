'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import ThemeToggle from './ThemeToggle'

const navItems = [
  { href: '/', label: 'Главная' },
  { href: '/goals', label: 'Цели' },
  { href: '/daily', label: 'План дня' },
  { href: '/progress', label: 'Прогресс' },
  { href: '/periods', label: 'Периоды' },
  { href: '/forecast', label: 'Прогнозы' },
  { href: '/history', label: 'История' },
  { href: '/analytics', label: 'Аналитика' },
  { href: '/tasks', label: 'Задачи' },
  { href: '/profile', label: 'Профиль' },
]

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [userName, setUserName] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Скрываем навигацию на страницах авторизации
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password'

  useEffect(() => {
    // Layout не размонтируется при переходе /login -> /, поэтому
    // после логина нужно заново подгрузить пользователя.
    if (isAuthPage) {
      setUserName(null)
      return
    }

    let cancelled = false

    fetch('/api/auth/me')
      .then((res) => {
        if (res.status === 401) {
          // Невалидный токен — редиректим на логин
          if (!cancelled) {
            router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`)
          }
          return null
        }
        return res.ok ? res.json() : null
      })
      .then((data) => {
        if (cancelled || !data) return
        const user = data?.user ?? data
        setUserName(user?.name || user?.email || null)
      })
      .catch(() => {
        if (!cancelled) setUserName(null)
      })

    return () => {
      cancelled = true
    }
  }, [isAuthPage, pathname, router])

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  // Не рендерим навигацию на страницах авторизации
  if (isAuthPage) {
    return null
  }

  return (
    <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between h-16">
        <div className="flex space-x-8">
          <Link href="/" className="flex items-center text-xl font-bold text-primary-600">
            AI Assistant
          </Link>
          <div className="flex space-x-1 items-center">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <ThemeToggle />
          {userName && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {userName}
              </span>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
              >
                {isLoggingOut ? '...' : 'Выход'}
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
