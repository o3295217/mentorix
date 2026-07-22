'use client'

import { usePathname } from 'next/navigation'
import AuthGuard from './AuthGuard'
import { useAuth } from './AuthProvider'
import LayoutFooter from './LayoutFooter'
import Navigation from './Navigation'
import { shouldShowAppChrome } from './navigationConfig'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const showAppChrome = shouldShowAppChrome(pathname, Boolean(user))

  return (
    <div className="app-shell flex flex-col">
      <Navigation />

      <main className={`app-main flex-1 ${showAppChrome ? 'app-main--with-chrome' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <AuthGuard>{children}</AuthGuard>
        </div>
      </main>

      <LayoutFooter />
    </div>
  )
}
