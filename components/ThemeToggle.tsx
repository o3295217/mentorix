'use client'

import { useTheme } from './ThemeProvider'

export default function ThemeToggle() {
  const { theme, resolvedTheme, toggleTheme } = useTheme()

  const label = theme === 'system'
    ? `Тема: системная (${resolvedTheme})`
    : `Тема: ${theme}`

  // Иконка показывает на что переключится при клике
  // dark → покажет солнце (перейти на light)
  // light → покажет луну (перейти на dark)
  // system → покажет монитор
  const showSun = resolvedTheme === 'dark' && theme !== 'system'
  const showMoon = resolvedTheme === 'light' && theme !== 'system'
  const showSystem = theme === 'system'

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      aria-label={`${label}. Нажмите, чтобы переключить`}
      title={label}
    >
      {showSystem ? (
        // Монитор для режима system
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17h4.5m-7.5 3h10.5M4.5 6.75A2.25 2.25 0 016.75 4.5h10.5A2.25 2.25 0 0119.5 6.75v7.5A2.25 2.25 0 0117.25 16.5H6.75A2.25 2.25 0 014.5 14.25v-7.5z" />
        </svg>
      ) : showSun ? (
        // Солнце — текущий режим тёмный, клик перейдёт на светлый
        <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        // Луна — текущий режим светлый, клик перейдёт на тёмный
        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  )
}
