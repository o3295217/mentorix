import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Проверяем, включена ли авторизация
// AUTH_ENABLED=false — однопользовательский режим (для локальной разработки)
// По умолчанию авторизация включена (многопользовательский режим)
// Отключается только явной установкой AUTH_ENABLED=false.
const AUTH_ENABLED = process.env.AUTH_ENABLED !== 'false'

// Публичные пути, не требующие авторизации
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/health',
]

// Проверка, является ли путь публичным
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path))
}

// Проверка, является ли путь статическим
function isStaticPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  )
}

export function middleware(request: NextRequest) {
  // Если авторизация отключена — пропускаем всё
  if (!AUTH_ENABLED) {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl

  // Пропускаем статические файлы
  if (isStaticPath(pathname)) {
    return NextResponse.next()
  }

  // Пропускаем публичные пути
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Проверяем наличие токена авторизации
  const token = request.cookies.get('auth_token')?.value

  if (!token) {
    // Для API возвращаем 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Для страниц редиректим на логин
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Токен есть, пропускаем запрос
  // Валидация токена происходит в API routes
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
