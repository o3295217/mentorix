import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'
import LayoutFooter from '@/components/LayoutFooter'
import AuthGuard from '@/components/AuthGuard'
import { Providers } from '@/components/Providers'
import { cookies } from 'next/headers'
import { DEFAULT_THEME_PREFERENCE, isThemePreference, THEME_COOKIE_KEY, type ThemePreference } from '@/lib/theme'

export const metadata: Metadata = {
  title: 'ION Assistant',
  description: 'Личный ИИ-ассистент для управления эффективностью. Превращаем мечту в ежедневное действие.',
  openGraph: {
    title: 'ION — ИИ-ассистент для достижения целей',
    description: 'Опиши свою цель. Каждый день — планируй, действуй, получай честную оценку от ИИ.',
    siteName: 'ION Assistant',
    locale: 'ru_RU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ION — ИИ-ассистент для достижения целей',
    description: 'Опиши свою цель. Каждый день — планируй, действуй, получай честную оценку от ИИ.',
  },
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
          <div className="min-h-screen flex flex-col overflow-x-hidden">
            <Navigation />

            <main className="flex-1">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <AuthGuard>{children}</AuthGuard>
              </div>
            </main>

            <LayoutFooter />
          </div>
        </Providers>
      </body>
    </html>
  )
}
