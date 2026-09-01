// «Профиль» на десктопе живёт не в списке разделов, а именной плашкой
// справа в шапке (см. Navigation.tsx) — правый угол отвечает на вопрос «кто я».
// «Главной» в списке нет — на неё ведёт логотип слева
export const desktopNavItems = [
  { href: '/daily', label: 'План дня' },
  { href: '/tasks', label: 'Задачи' },
  { href: '/goals', label: 'Цели' },
  { href: '/progress', label: 'Прогресс' },
  { href: '/periods', label: 'Периоды' },
  { href: '/analytics', label: 'Аналитика' },
  { href: '/history', label: 'История' },
  { href: '/forecast', label: 'Прогнозы' },
] as const

export const primaryMobileNavItems = [
  { href: '/', label: 'Главная', icon: 'home' },
  { href: '/daily', label: 'День', icon: 'day' },
  { href: '/tasks', label: 'Задачи', icon: 'tasks' },
  { href: '/goals', label: 'Цели', icon: 'goals' },
] as const

export const moreNavItems = [
  { href: '/progress', label: 'Прогресс' },
  { href: '/periods', label: 'Периоды' },
  { href: '/analytics', label: 'Аналитика' },
  { href: '/history', label: 'История' },
  { href: '/forecast', label: 'Прогнозы' },
  { href: '/profile', label: 'Профиль' },
] as const

const chromeHiddenPaths = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/onboarding',
] as const

export function isRouteActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

export function isMoreRouteActive(pathname: string): boolean {
  return moreNavItems.some((item) => isRouteActive(pathname, item.href))
}

export function shouldShowAppChrome(pathname: string, hasUser: boolean): boolean {
  const isHiddenPath = chromeHiddenPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )

  return !isHiddenPath && !(pathname === '/' && !hasUser)
}

export function getFocusTrapTargetIndex(
  activeIndex: number,
  itemCount: number,
  shiftKey: boolean,
): number | null {
  if (itemCount <= 0) return null
  if (activeIndex < 0) return shiftKey ? itemCount - 1 : 0
  if (shiftKey && activeIndex === 0) return itemCount - 1
  if (!shiftKey && activeIndex === itemCount - 1) return 0
  return null
}
