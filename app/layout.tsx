import type { Metadata, Viewport } from 'next'
import { Manrope, Orbitron } from 'next/font/google'
import './globals.css'
import AppShell from '@/components/AppShell'
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
  title: 'mentorix',
  description: 'Личный ИИ-ассистент для управления эффективностью. Превращаем мечту в ежедневное действие.',
  openGraph: {
    title: 'mentorix — ИИ-ассистент для достижения целей',
    description: 'Опиши свою цель. Каждый день — планируй, действуй, получай честную оценку от ИИ.',
    siteName: 'mentorix',
    locale: 'ru_RU',
    type: 'website',
    url: appUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'mentorix — ИИ-ассистент для достижения целей',
    description: 'Опиши свою цель. Каждый день — планируй, действуй, получай честную оценку от ИИ.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`dark ${manrope.variable} ${orbitron.variable}`}>
      <body className={manrope.className} suppressHydrationWarning>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
