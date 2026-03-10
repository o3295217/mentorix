import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'
import LayoutFooter from '@/components/LayoutFooter'
import AuthGuard from '@/components/AuthGuard'
import { Providers } from '@/components/Providers'

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap" rel="stylesheet" />
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
