import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'
import { DEFAULT_THEME_PREFERENCE, isThemePreference, THEME_COOKIE_KEY, type ThemePreference } from '@/lib/theme'
import { shouldUseSecureCookies } from '@/lib/cookie-security'

function setThemeCookie(response: NextResponse, theme: ThemePreference) {
  const useSecureCookie = shouldUseSecureCookies()
  response.cookies.set(THEME_COOKIE_KEY, theme, {
    httpOnly: false,
    secure: useSecureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 год
  })
}

// GET /api/profile/theme - получить тему пользователя
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { themePreference: true },
    })

    const theme = user?.themePreference ?? DEFAULT_THEME_PREFERENCE

    const response = NextResponse.json({ theme })
    setThemeCookie(response, theme)
    return response
  } catch (error) {
    console.error('Error fetching theme:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch theme' }, { status: 500 })
  }
}

// POST /api/profile/theme - сохранить тему пользователя
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()

    const nextThemeRaw = body?.theme
    if (!isThemePreference(nextThemeRaw)) {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 })
    }

    const userExists = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true } })
    if (userExists) {
      await prisma.user.update({
        where: { id: userId },
        data: { themePreference: nextThemeRaw },
      })
    }

    const response = NextResponse.json({ success: true, theme: nextThemeRaw })
    setThemeCookie(response, nextThemeRaw)
    return response
  } catch (error) {
    console.error('Error saving theme:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to save theme' }, { status: 500 })
  }
}
