import { describe, expect, it } from 'vitest'
import {
  getFocusTrapTargetIndex,
  isMoreRouteActive,
  isRouteActive,
  shouldShowAppChrome,
} from '@/components/navigationConfig'

describe('navigationConfig', () => {
  it('определяет точный и вложенный активный маршрут без совпадений по общему префиксу', () => {
    expect(isRouteActive('/', '/')).toBe(true)
    expect(isRouteActive('/goals/goal-1', '/goals')).toBe(true)
    expect(isRouteActive('/goals-archive', '/goals')).toBe(false)
  })

  it('подсвечивает «Ещё» на всех вторичных маршрутах', () => {
    for (const pathname of ['/progress', '/periods/week', '/analytics', '/history', '/forecast', '/profile']) {
      expect(isMoreRouteActive(pathname)).toBe(true)
    }
    expect(isMoreRouteActive('/daily')).toBe(false)
  })

  it('скрывает app chrome на auth, onboarding и публичной главной', () => {
    expect(shouldShowAppChrome('/login', false)).toBe(false)
    expect(shouldShowAppChrome('/reset-password/token', false)).toBe(false)
    expect(shouldShowAppChrome('/onboarding', true)).toBe(false)
    expect(shouldShowAppChrome('/', false)).toBe(false)
    expect(shouldShowAppChrome('/', true)).toBe(true)
    expect(shouldShowAppChrome('/daily', true)).toBe(true)
  })

  it('зацикливает фокус только на границах модальной панели', () => {
    expect(getFocusTrapTargetIndex(0, 4, true)).toBe(3)
    expect(getFocusTrapTargetIndex(3, 4, false)).toBe(0)
    expect(getFocusTrapTargetIndex(-1, 4, false)).toBe(0)
    expect(getFocusTrapTargetIndex(-1, 4, true)).toBe(3)
    expect(getFocusTrapTargetIndex(1, 4, false)).toBeNull()
    expect(getFocusTrapTargetIndex(1, 4, true)).toBeNull()
    expect(getFocusTrapTargetIndex(0, 0, false)).toBeNull()
  })
})
