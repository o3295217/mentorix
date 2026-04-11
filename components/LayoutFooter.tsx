'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
import FooterSection from './landing/FooterSection'

const HIDDEN_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/onboarding']

export default function LayoutFooter() {
  const pathname = usePathname()
  const { user } = useAuth()

  const isHidden = HIDDEN_PATHS.some(p => pathname?.startsWith(p)) || (pathname === '/' && !user)

  if (isHidden) {
    return null
  }

  return <FooterSection />
}
