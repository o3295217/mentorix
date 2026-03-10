'use client'

import { createContext, useContext } from 'react'

type ResolvedTheme = 'dark'

interface ThemeContextType {
  theme: 'dark'
  resolvedTheme: ResolvedTheme
  setTheme: (theme: string) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value: ThemeContextType = {
    theme: 'dark',
    resolvedTheme: 'dark',
    setTheme: () => {},
    toggleTheme: () => {},
  }

  return (
    <ThemeContext.Provider value={value}>
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
