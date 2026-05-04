import type { Metadata } from 'next'
import { Manrope, Orbitron } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import LayoutFooter from '@/components/LayoutFooter'
import AuthGuard from '@/components/AuthGuard'
import { Providers } from '@/components/Providers'
import { getAppUrl } from '@/lib/app-url'

const appUrl = getAppUrl()

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-manrope',
  display: 'swap',
})

const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-orbitron',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: 'AION',
  description: 'Личный ИИ-ассистент для управления эффективностью. Превращаем мечту в ежедневное действие.',
  openGraph: {
    title: 'AION — ИИ-ассистент для достижения целей',
    description: 'Опиши свою цель. Каждый день — планируй, действуй, получай честную оценку от ИИ.',
    siteName: 'AION',
    locale: 'ru_RU',
    type: 'website',
    url: appUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AION — ИИ-ассистент для достижения целей',
    description: 'Опиши свою цель. Каждый день — планируй, действуй, получай честную оценку от ИИ.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`dark ${manrope.variable} ${orbitron.variable}`}>
      <body className={manrope.className} suppressHydrationWarning>
        <Providers>
          <div className="min-h-screen flex flex-col overflow-x-hidden">
            <Navigation />

            <main className="flex-1 pt-16">
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
