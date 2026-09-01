'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthProvider'
import InstallAppButton from './InstallAppButton'
import HeaderDailyDate from './HeaderDailyDate'
import {
  desktopNavItems,
  getFocusTrapTargetIndex,
  isMoreRouteActive,
  isRouteActive,
  moreNavItems,
  primaryMobileNavItems,
  shouldShowAppChrome,
} from './navigationConfig'

type MobileIcon = (typeof primaryMobileNavItems)[number]['icon'] | 'more'

function MobileNavIcon({ icon }: { icon: MobileIcon }) {
  const paths: Record<MobileIcon, React.ReactNode> = {
    home: <path strokeLinecap="round" strokeLinejoin="round" d="m3 11.25 9-7.5 9 7.5M5.25 9.375V20.25h13.5V9.375M9 20.25v-6h6v6" />,
    day: <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M5.25 4.5h13.5a1.5 1.5 0 0 1 1.5 1.5v13.5a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5Z" />,
    tasks: <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 6.75 1.5 1.5 3-3M4.5 12l1.5 1.5 3-3M4.5 17.25l1.5 1.5 3-3M11.25 7.5h8.25M11.25 12.75h8.25M11.25 18h8.25" />,
    goals: <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0-3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />,
    more: <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm7.5 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm7.5 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />,
  }

  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      {paths[icon]}
    </svg>
  )
}

export default function Navigation() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const firstMoreLinkRef = useRef<HTMLAnchorElement>(null)
  const moreDialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    setIsMoreMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isMoreMenuOpen) return

    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => firstMoreLinkRef.current?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsMoreMenuOpen(false)
        moreButtonRef.current?.focus()
        return
      }

      if (event.key === 'Tab') {
        const dialog = moreDialogRef.current
        if (!dialog) return

        const focusableElements = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        )
        const activeIndex = focusableElements.indexOf(document.activeElement as HTMLElement)
        const targetIndex = getFocusTrapTargetIndex(
          activeIndex,
          focusableElements.length,
          event.shiftKey,
        )

        if (targetIndex !== null) {
          event.preventDefault()
          focusableElements[targetIndex]?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousBodyOverflow
    }
  }, [isMoreMenuOpen])

  const userName = user?.name || user?.email || null
  const moreRouteActive = isMoreRouteActive(pathname)

  const closeMoreMenu = (restoreFocus = false) => {
    setIsMoreMenuOpen(false)
    if (restoreFocus) {
      moreButtonRef.current?.focus()
    }
  }

  const handleLogout = async () => {
    closeMoreMenu()
    setIsLoggingOut(true)
    try {
      await logout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  if (!shouldShowAppChrome(pathname, Boolean(user))) {
    return null
  }

  return (
    <>
      <header className="app-top-header fixed inset-x-0 top-0 z-50 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
        <nav aria-label="Основная навигация" className="app-top-nav-inner mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between lg:h-16">
            <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-4">
              <Link href="/" className="flex min-h-11 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                <span className="nav-logo" aria-label="mentorix">mentorix</span>
              </Link>

              <div className="hidden min-w-0 items-center space-x-0.5 overflow-x-clip lg:flex">
                {desktopNavItems.map((item) => {
                  const active = isRouteActive(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`nav-menu-link whitespace-nowrap rounded-md px-2.5 py-1.5 transition-colors ${
                        active
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-blue-400'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>

            {userName && (
              <div className="ml-6 flex min-w-0 flex-shrink-0 items-center gap-3 border-l border-gray-800 bg-gray-900/80 pl-4">
                {/* Дата плана дня закреплена в шапке — вне контейнера ссылок с overflow-x-clip, иначе её срезает на узких окнах */}
                <div className="hidden shrink-0 lg:block">
                  <HeaderDailyDate />
                </div>
                {/* По умолчанию только кружок с инициалом; имя выезжает при наведении/фокусе */}
                <Link
                  href="/profile"
                  title={user ? `${user.name || 'Без имени'} · ${user.email}` : undefined}
                  aria-current={isRouteActive(pathname, '/profile') ? 'page' : undefined}
                  className={`group flex min-h-11 items-center rounded-md px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    isRouteActive(pathname, '/profile')
                      ? 'text-blue-300'
                      : 'text-gray-400 hover:text-blue-300'
                  }`}
                  aria-label={`Профиль: ${userName}`}
                >
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-sm font-extrabold text-blue-400" aria-hidden="true">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-0 overflow-hidden whitespace-nowrap pl-0 opacity-0 transition-all duration-200 group-hover:max-w-[12rem] group-hover:pl-2 group-hover:opacity-100 group-focus-visible:max-w-[12rem] group-focus-visible:pl-2 group-focus-visible:opacity-100">
                    {userName}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  title="Выход"
                  aria-label="Выход"
                  className="group hidden h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50 lg:flex"
                >
                  {/* Круглая подложка — в точности как у инициала профиля */}
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/10 text-red-400/80 transition-colors group-hover:bg-red-500/20 group-hover:text-red-300" aria-hidden="true">
                    {isLoggingOut ? (
                      <span className="text-xs">…</span>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6A2.25 2.25 0 0 0 5.25 5.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                      </svg>
                    )}
                  </span>
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      {isMoreMenuOpen && (
        <div className="lg:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Закрыть меню «Ещё»"
            className="fixed inset-0 z-[55] cursor-default bg-black/60"
            onClick={() => closeMoreMenu(true)}
          />
          <section
            ref={moreDialogRef}
            id="mobile-more-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-more-menu-title"
            tabIndex={-1}
            className="mobile-more-sheet fixed inset-x-0 z-[60] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-gray-700 bg-gray-900/95 shadow-2xl"
          >
            <div className="mx-auto w-full max-w-lg px-4 pb-4 pt-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-600" aria-hidden="true" />
              <h2 id="mobile-more-menu-title" className="px-2 text-sm font-semibold text-gray-300">Ещё</h2>
              <nav aria-label="Дополнительная навигация" className="mt-2 grid gap-1">
                {moreNavItems.map((item, index) => {
                  const active = isRouteActive(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      ref={index === 0 ? firstMoreLinkRef : undefined}
                      href={item.href}
                      onClick={() => closeMoreMenu()}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-11 items-center rounded-xl px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                        active ? 'bg-blue-500/15 text-blue-300' : 'text-gray-200 hover:bg-gray-800'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
              <div className="mt-3 border-t border-gray-800 pt-3">
                <InstallAppButton variant="menu" className="mb-1" />
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex min-h-11 w-full items-center rounded-xl px-4 text-sm font-medium text-red-300 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
                >
                  {isLoggingOut ? 'Выходим…' : 'Выйти'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      <nav aria-label="Мобильная навигация" className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-gray-700 bg-gray-900/95 backdrop-blur-md lg:hidden">
        <div className="grid h-16 grid-cols-5">
          {primaryMobileNavItems.map((item) => {
            const active = isRouteActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`mobile-bottom-nav-item ${active ? 'text-blue-300' : 'text-gray-400'}`}
              >
                <MobileNavIcon icon={item.icon} />
                <span>{item.label}</span>
              </Link>
            )
          })}
          <button
            ref={moreButtonRef}
            type="button"
            aria-expanded={isMoreMenuOpen}
            aria-controls="mobile-more-menu"
            aria-current={moreRouteActive ? 'page' : undefined}
            onClick={() => setIsMoreMenuOpen((open) => !open)}
            className={`mobile-bottom-nav-item ${moreRouteActive || isMoreMenuOpen ? 'text-blue-300' : 'text-gray-400'}`}
          >
            <MobileNavIcon icon="more" />
            <span>Ещё</span>
          </button>
        </div>
      </nav>
    </>
  )
}
