import { NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

// Rate limiter для login - строгий для защиты от брутфорса
const loginRateLimiter = {
  limit: 5, // 5 попыток
  windowMs: 15 * 60 * 1000, // 15 минут
  keyPrefix: 'login',
};

export async function POST(request: Request) {
  try {
    // Проверяем rate limit
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientId, loginRateLimiter);
    
    if (!rateLimit.success) {
      return NextResponse.json(
        { 
          error: 'Слишком много попыток. Попробуйте позже.',
          retryAfter: Math.ceil((rateLimit.retryAfter || 0) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.retryAfter || 0) / 1000))
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

    return response;
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
