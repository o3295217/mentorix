'use client'

import { createContext, useContext, useEffect, useState } from 'react'

import {
  DEFAULT_THEME_PREFERENCE,
  isThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme'

interface ThemeContextType {
  theme: ThemePreference
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemePreference) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(DEFAULT_THEME_PREFERENCE)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const themeFromDomRaw = document.documentElement.dataset.theme
    const themeFromDom = isThemePreference(themeFromDomRaw) ? themeFromDomRaw : null

    const savedThemeRaw = localStorage.getItem(THEME_STORAGE_KEY)
    const savedTheme = isThemePreference(savedThemeRaw) ? savedThemeRaw : null

    const initialPreference = themeFromDom ?? savedTheme ?? DEFAULT_THEME_PREFERENCE
    setThemeState(initialPreference)

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setResolvedTheme(resolveTheme(initialPreference, prefersDark))
  }, [])

  const persistThemePreference = async (nextTheme: ThemePreference) => {
    try {
      await fetch('/api/profile/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: nextTheme }),
      })
    } catch {
      // no-op
    }
  }

  const setTheme = (nextTheme: ThemePreference) => {
    setThemeState(nextTheme)
    if (mounted) {
      void persistThemePreference(nextTheme)
    }
  }

  useEffect(() => {
    if (!mounted) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const applyResolvedTheme = (nextResolved: ResolvedTheme) => {
      document.documentElement.classList.toggle('dark', nextResolved === 'dark')
      setResolvedTheme(nextResolved)
    }

    const prefersDark = mediaQuery.matches
    applyResolvedTheme(resolveTheme(theme, prefersDark))
    localStorage.setItem(THEME_STORAGE_KEY, theme)
    document.documentElement.dataset.theme = theme

    if (theme !== 'system') return

    const onChange = (event: MediaQueryListEvent) => {
      applyResolvedTheme(resolveTheme('system', event.matches))
    }

    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [theme, mounted])

  const toggleTheme = () => {
    const nextTheme: ThemePreference = theme === 'light'
      ? 'dark'
      : theme === 'dark'
        ? 'system'
        : 'light'
    setTheme(nextTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
