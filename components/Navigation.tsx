'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
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

  // Скрываем навигацию на главной для неавторизованных (показывается Landing)
  const isLandingPage = pathname === '/' && !user

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

  // Не рендерим навигацию на страницах авторизации и Landing
  if (isAuthPage || isLandingPage) {
    return null
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800">
    <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between h-16">
        <div className="flex space-x-8">
          <Link href="/" className="flex items-center">
            <span className="nav-logo" aria-label="ION Assistant">
              <span className="nav-logo-a">A</span>
              <span className="nav-logo-i">I</span>
              <span className="nav-logo-on">ON</span>
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
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'text-gray-400 hover:text-blue-400 hover:bg-gray-800'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {userName && (
            <div className="hidden sm:flex items-center space-x-2">
              <span className="text-base text-gray-400">
                {userName}
              </span>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-3 py-1.5 text-base font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50"
              >
                {isLoggingOut ? '...' : 'Выход'}
              </button>
            </div>
          )}
          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:bg-gray-800 transition-colors"
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
        <div className="lg:hidden border-t border-gray-800 py-2">
          <div className="flex flex-col space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'text-gray-400 hover:text-blue-400 hover:bg-gray-800'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          {userName && (
            <div className="sm:hidden border-t border-gray-800 mt-2 pt-2 px-3 flex items-center justify-between">
              <span className="text-base text-gray-400">
                {userName}
              </span>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-3 py-1.5 text-base font-medium text-red-400 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50"
              >
                {isLoggingOut ? '...' : 'Выход'}
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
    </header>
  )
}
