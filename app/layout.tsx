import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'
import AuthGuard from '@/components/AuthGuard'
import { Providers } from '@/components/Providers'
import { cookies } from 'next/headers'
import { DEFAULT_THEME_PREFERENCE, isThemePreference, THEME_COOKIE_KEY, type ThemePreference } from '@/lib/theme'

export const metadata: Metadata = {
  title: 'ION Assistant',
  description: 'Личный ИИ-ассистент для управления эффективностью',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const themeCookie = cookieStore.get(THEME_COOKIE_KEY)?.value
  const initialTheme: ThemePreference = isThemePreference(themeCookie)
    ? themeCookie
    : DEFAULT_THEME_PREFERENCE

  const initialHtmlClassName = initialTheme === 'dark' ? 'dark' : undefined

  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={initialHtmlClassName}
      data-theme={initialTheme}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    const d = document.documentElement;
    const pref = d.dataset.theme;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = pref === 'dark' || (pref === 'system' && prefersDark);
    if (isDark) d.classList.add('dark'); else d.classList.remove('dark');
  } catch (_) {}
})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
              <Navigation />
            </header>

            <main className="flex-1">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <AuthGuard>{children}</AuthGuard>
              </div>
            </main>

            <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                  © {new Date().getFullYear()} AI Lab ION-1
                </p>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  )
}
