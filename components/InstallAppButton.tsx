'use client'

import { useCallback, useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIos = /iPhone|iPad|iPod/.test(ua)
  // iPadOS 13+ маскируется под Mac, но остаётся тач-устройством
  const isIpadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  return isIos || isIpadOs
}

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export default function InstallAppButton({ className = '' }: { className?: string }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => {
    if (isStandaloneMode()) return

    const ios = isIosDevice()
    setIsIos(ios)
    // на iOS программной установки нет — кнопка показывает подсказку
    if (ios) setVisible(true)

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setVisible(true)
    }
    const onInstalled = () => {
      setInstallPrompt(null)
      setVisible(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const handleClick = useCallback(async () => {
    if (installPrompt) {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') setVisible(false)
      // повторно тот же prompt использовать нельзя
      setInstallPrompt(null)
      return
    }
    if (isIos) setShowIosHint((open) => !open)
  }, [installPrompt, isIos])

  if (!visible) return null

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => void handleClick()}
        className="flex w-full items-center justify-center gap-2 px-8 py-4 text-lg font-semibold text-gray-300 rounded-2xl border border-gray-700 hover:border-gray-500 hover:text-white transition-all duration-300 sm:w-auto"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
          <path d="M12 14.5v-7" />
          <path d="M9.5 12l2.5 2.5L14.5 12" />
        </svg>
        Установить на телефон
      </button>

      {showIosHint && (
        <div
          role="dialog"
          aria-label="Как установить на iPhone"
          className="absolute left-1/2 top-full z-20 mt-3 w-72 -translate-x-1/2 rounded-2xl border border-gray-700 bg-gray-900/95 p-4 text-left text-sm text-gray-200 shadow-xl"
        >
          <p className="font-semibold text-white">Установка на iPhone/iPad</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-gray-300">
            <li>Откройте сайт в Safari</li>
            <li>
              Нажмите «Поделиться»
              <span aria-hidden="true" className="mx-1 inline-block rounded border border-gray-600 px-1 text-xs align-middle">⬆</span>
            </li>
            <li>Выберите «На экран „Домой&ldquo;»</li>
          </ol>
          <button
            type="button"
            onClick={() => setShowIosHint(false)}
            className="mt-3 w-full rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:border-gray-500 hover:text-white"
          >
            Понятно
          </button>
        </div>
      )}
    </div>
  )
}
