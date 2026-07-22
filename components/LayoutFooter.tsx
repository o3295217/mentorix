'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
import FooterSection from './landing/FooterSection'
import { shouldShowAppChrome } from './navigationConfig'

export default function LayoutFooter() {
  const pathname = usePathname()
  const { user } = useAuth()

  if (!shouldShowAppChrome(pathname, Boolean(user))) {
    return null
  }

  return (
    <div className="app-shell-footer">
      <FooterSection />
    </div>
  )
}
