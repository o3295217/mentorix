'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import ThemeToggle from './ThemeToggle'
import { useAuth } from './AuthProvider'

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
  const { user, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Скрываем навигацию на страницах авторизации
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password'

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
