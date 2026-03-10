'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'

const HIDDEN_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/onboarding']

export default function LayoutFooter() {
  const pathname = usePathname()
  const { user } = useAuth()

  const isHidden = HIDDEN_PATHS.some(p => pathname?.startsWith(p)) || (pathname === '/' && !user)

  if (isHidden) {
    return null
  }

  return (
    <footer className="bg-gray-900/50 border-t border-gray-800/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <p className="text-center text-sm text-gray-400">
          © {new Date().getFullYear()} AI Lab ION-1
        </p>
      </div>
    </footer>
  )
}
