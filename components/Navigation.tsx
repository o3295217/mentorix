'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import ThemeToggle from './ThemeToggle'
import { useAuth } from './AuthProvider'

const navItems = [
  { href: '/', label: 'Главная' },
  { href: '/daily', label: 'План дня' },
  { href: '/tasks', label: 'Задачи' },
  { href: '/goals', label: 'Цели' },
  { href: '/progress', label: 'Прогресс' },
  { href: '/periods', label: 'Периоды' },
  { href: '/analytics', label: 'Аналитика' },
  { href: '/history', label: 'История' },
  { href: '/forecast', label: 'Прогнозы' },
  { href: '/profile', label: 'Профиль' },
]

export default function Navigation() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Закрываем мобильное меню при смене страницы
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  // Скрываем навигацию на страницах авторизации и онбординга
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/verify-email' ||
    pathname === '/onboarding'

  const userName = user?.name || user?.email || null

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  // Не рендерим навигацию на страницах авторизации
  if (isAuthPage) {
    return null
  }

  return (
    <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between h-16">
        <div className="flex space-x-8">
          <Link href="/" className="flex items-center">
            {/* Буква A */}
            <svg width="36" height="42" viewBox="0 0 24 28" className="flex-shrink-0">
              <path d="M12 1 L1 27 M12 1 L12 27 M4 18 L12 18" 
                    fill="none" stroke="#4a7c9b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="flex flex-col justify-center leading-tight -ml-1">
              <span className="text-base font-semibold tracking-tight">
                <span className="text-gray-400 dark:text-gray-500 font-light text-lg">[</span><span className="text-[#4a7c9b] font-bold text-xl">I</span><span className="text-gray-400 dark:text-gray-500 font-light text-lg">]</span><span className="text-gray-900 dark:text-white text-lg">On</span>
              </span>
              <span className="text-base text-gray-900 dark:text-white tracking-tight">ssistant</span>
            </span>
          </Link>
          {/* Desktop menu */}
          <div className="hidden lg:flex space-x-1 items-center">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-base font-medium transition-colors whitespace-nowrap ${
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
            <div className="hidden sm:flex items-center space-x-2">
              <span className="text-base text-gray-600 dark:text-gray-400">
                {userName}
              </span>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-3 py-1.5 text-base font-medium text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
              >
                {isLoggingOut ? '...' : 'Выход'}
              </button>
            </div>
          )}
          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Меню"
          >
            {isMobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 dark:border-gray-700 py-2">
          <div className="flex flex-col space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          {userName && (
            <div className="sm:hidden border-t border-gray-200 dark:border-gray-700 mt-2 pt-2 px-3 flex items-center justify-between">
              <span className="text-base text-gray-600 dark:text-gray-400">
                {userName}
              </span>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-3 py-1.5 text-base font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
              >
                {isLoggingOut ? '...' : 'Выход'}
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
