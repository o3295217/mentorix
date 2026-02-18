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

function isPublicPath(pathname: string | null): boolean {
  // Главная страница публична (показывает Landing или Dashboard)
  if (pathname === '/') return true
  return PUBLIC_PATHS.some(p => pathname?.startsWith(p))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    // На публичных страницах не проверяем
    if (isPublicPath(pathname)) {
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/me')

      if (res.status === 401) {
        setUser(null)
        router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`)
        return
      }

      if (res.ok) {
        const data = await res.json()
        // API может возвращать { user: {...} } или напрямую {...}
        const userData = data?.user ?? data
        setUser(userData)
        
        // Редирект на онбординг для новых пользователей
        if (!userData.onboardingCompleted && pathname !== '/onboarding') {
          router.push('/onboarding')
        }
      }
    } catch (error) {
      console.error('Auth check error:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [pathname, router])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
      router.push('/login')
    }
  }, [router])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isAuthenticated: !!user,
    logout,
    refresh: checkAuth,
  }), [user, loading, logout, checkAuth])

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
