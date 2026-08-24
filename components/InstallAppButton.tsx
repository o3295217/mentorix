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

type InstallAppButtonProps = {
  className?: string
  /**
   * landing — крупная кнопка-рамка в hero; menu — компактная строка для меню
   * приложения; cta — градиентная «пилюля» в стиле кнопки «Начать путь»
   */
  variant?: 'landing' | 'menu' | 'cta'
}

export default function InstallAppButton({ className = '', variant = 'landing' }: InstallAppButtonProps) {
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

  const buttonClassName = variant === 'menu'
    ? 'flex min-h-11 w-full items-center gap-3 rounded-xl px-4 text-sm font-medium text-gray-200 hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
    : variant === 'cta'
      ? 'group relative inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-full border border-blue-300/20 px-10 py-4 text-lg font-semibold text-white shadow-[0_20px_60px_rgba(37,99,235,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_80px_rgba(59,130,246,0.30)] active:translate-y-0 sm:w-auto'
      : 'flex w-full items-center justify-center gap-2 px-8 py-4 text-lg font-semibold text-gray-300 rounded-2xl border border-gray-700 hover:border-gray-500 hover:text-white transition-all duration-300 sm:w-auto'

  const iosHint = (
    <div
      role="dialog"
      aria-label="Как установить на iPhone"
      className={
        variant === 'menu'
          ? 'mt-2 rounded-xl border border-gray-700 bg-gray-800/80 p-3 text-left text-sm text-gray-200'
          : 'absolute left-1/2 top-full z-20 mt-3 w-72 -translate-x-1/2 rounded-2xl border border-gray-700 bg-gray-900/95 p-4 text-left text-sm text-gray-200 shadow-xl'
      }
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
  )

  return (
    <div className={`relative ${className}`}>
      <button type="button" onClick={() => void handleClick()} className={buttonClassName}>
        {variant === 'cta' && (
          <>
            <span className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#2563eb_0%,#3b82f6_45%,#6366f1_100%)] transition-all duration-300 group-hover:brightness-110" />
            <span className="absolute inset-[1px] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03)_22%,rgba(15,23,42,0.04)_100%)]" />
            <span className="absolute -left-1/3 top-0 h-full w-1/3 -skew-x-12 bg-white/20 opacity-0 blur-xl transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />
          </>
        )}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="relative h-5 w-5 flex-shrink-0" aria-hidden="true">
          <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
          <path d="M12 14.5v-7" />
          <path d="M9.5 12l2.5 2.5L14.5 12" />
        </svg>
        <span className="relative">Взять Ментрикса с собой</span>
      </button>
      {showIosHint && iosHint}
    </div>
  )
}
