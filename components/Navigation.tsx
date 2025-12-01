'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Главная' },
  { href: '/goals', label: 'Цели' },
  { href: '/daily', label: 'Планирование' },
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

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
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
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
