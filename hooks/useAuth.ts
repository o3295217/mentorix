'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface User {
  id: string
  email: string
  name: string
  role: string
}

export function useAuth() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [pathname])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      
      if (res.status === 401) {
        setUser(null)
        setIsAuthenticated(false)
        // Редирект на логин если не на публичной странице
        const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password']
        if (!publicPaths.some(p => pathname?.startsWith(p))) {
          router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`)
        }
        return
      }

      if (res.ok) {
        const userData = await res.json()
        setUser(userData)
        setIsAuthenticated(true)
      }
    } catch (error) {
      console.error('Auth check error:', error)
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      setIsAuthenticated(false)
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return {
    user,
    loading,
    isAuthenticated,
    logout,
    checkAuth,
  }
}
