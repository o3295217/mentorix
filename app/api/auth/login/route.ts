import { NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, rateLimiters } from '@/lib/rate-limit';
import { DEFAULT_THEME_PREFERENCE, THEME_COOKIE_KEY } from '@/lib/theme'
import { signToken, AUTH_SIG_COOKIE } from '@/lib/hmac'

export async function POST(request: Request) {
  try {
    // Проверяем rate limit
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientId, rateLimiters.auth);
    
    if (!rateLimit.success) {
      return NextResponse.json(
        { 
          error: 'Слишком много попыток. Попробуйте позже.',
          retryAfter: rateLimit.retryAfter
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter)
          }
        }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email и пароль обязательны' },
        { status: 400 }
      );
    }

    // Получаем информацию о клиенте
    const userAgent = request.headers.get('User-Agent') || undefined;
    const forwardedFor = request.headers.get('X-Forwarded-For');
    const ipAddress = forwardedFor?.split(',')[0].trim() || undefined;

    const result = await loginUser(email, password, userAgent, ipAddress);

    if (!result.success || !result.session) {
      // Email не подтверждён
      if (result.emailNotVerified) {
        return NextResponse.json(
          { 
            error: 'Email не подтверждён',
            emailNotVerified: true
          },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { error: result.error || 'Ошибка авторизации' },
        { status: 401 }
      );
    }

    // Создаём ответ с cookie
    const response = NextResponse.json({
      success: true,
      user: result.session.user,
    });

    // Устанавливаем cookie
    // Secure только если явно указано (для HTTPS)
    const useSecureCookie = process.env.COOKIE_SECURE === 'true';
    response.cookies.set('auth_token', result.session.token, {
      httpOnly: true,
      secure: useSecureCookie,
      sameSite: 'lax',
      expires: result.session.expiresAt,
      path: '/',
    });

    // HMAC-подпись токена для верификации в middleware (без обращения к БД)
    const authSecret = process.env.AUTH_SECRET;
    if (!authSecret) {
      console.error('AUTH_SECRET not set');
      return NextResponse.json(
        { error: 'Ошибка конфигурации сервера' },
        { status: 500 }
      );
    }
    
    const sig = await signToken(result.session.token, authSecret);
    response.cookies.set(AUTH_SIG_COOKIE, sig, {
      httpOnly: true,
      secure: useSecureCookie,
      sameSite: 'lax',
      expires: result.session.expiresAt,
      path: '/',
    });

    // Устанавливаем cookie темы (берём из уже загруженных данных сессии)
    const theme = result.session.user.themePreference ?? DEFAULT_THEME_PREFERENCE
    response.cookies.set(THEME_COOKIE_KEY, theme, {
      httpOnly: false,
      secure: useSecureCookie,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })

    return response;
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
