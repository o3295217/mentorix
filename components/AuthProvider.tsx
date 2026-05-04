'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface AuthUser {
  id: string
  email: string
  name: string | null
  role: string
  onboardingCompleted?: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
  /** Принудительная перепроверка авторизации */
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email']

/** Страницы авторизации — не проверяем auth вообще */
function isAuthPage(pathname: string | null): boolean {
  return PUBLIC_PATHS.some(p => pathname?.startsWith(p))
}

/** Страницы, где проверяем auth, но не редиректим на логин если не авторизован */
function isOptionalAuthPage(pathname: string | null): boolean {
  return pathname === '/'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)

  const loadUser = useCallback(async (): Promise<AuthUser | null> => {
    setLoading(true)

    try {
      const res = await fetch('/api/auth/me')

      if (res.status === 401) {
        setUser(null)
        return null
      }

      if (res.ok) {
        const data = await res.json()
        // API может возвращать { user: {...} } или напрямую {...}
        const userData = data?.user ?? data
        setUser(userData)
        return userData
      }

      setUser(null)
      return null
    } catch (error) {
      console.error('Auth check error:', error)
      setUser(null)
      return null
    } finally {
      setAuthChecked(true)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthPage(pathname)) {
      setLoading(false)
      setAuthChecked(false)
      return
    }

    let cancelled = false

    async function ensureAuthForRoute() {
      const currentUser = authChecked ? user : await loadUser()
      if (cancelled) return

      const optional = isOptionalAuthPage(pathname)
      if (!currentUser) {
        if (!optional) {
          router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`)
        }
        return
      }

      if (!currentUser.onboardingCompleted && pathname !== '/onboarding') {
        router.push('/onboarding')
      }
    }

    void ensureAuthForRoute()

    return () => {
      cancelled = true
    }
  }, [authChecked, loadUser, pathname, router, user])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
      setAuthChecked(false)
      router.push('/login')
    }
  }, [router])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isAuthenticated: !!user,
    logout,
    refresh: async () => { await loadUser() },
  }), [user, loading, logout, loadUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Хук для доступа к авторизации. Единый источник правды — один fetch /api/auth/me.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>')
  }
  return ctx
}
