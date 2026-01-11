import { NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
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
