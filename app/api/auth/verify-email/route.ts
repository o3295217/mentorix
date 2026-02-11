import { NextResponse } from 'next/server';
import { verifyEmailToken, getUserById, createSession } from '@/lib/auth';
import { signToken, AUTH_SIG_COOKIE } from '@/lib/hmac';
import { DEFAULT_THEME_PREFERENCE, THEME_COOKIE_KEY } from '@/lib/theme';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Токен не указан' },
        { status: 400 }
      );
    }

    const result = await verifyEmailToken(token);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Ошибка верификации' },
        { status: 400 }
      );
    }

    // Получаем пользователя и создаём сессию
    const user = await getUserById(result.userId!);
    if (!user) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 400 }
      );
    }

    const session = await createSession(user.id);
    
    const response = NextResponse.json({
      success: true,
      message: 'Email подтверждён',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });

    // Устанавливаем cookies сессии
    const useSecureCookie = process.env.COOKIE_SECURE === 'true';
    
    response.cookies.set('auth_token', session.token, {
      httpOnly: true,
      secure: useSecureCookie,
      sameSite: 'lax',
      expires: session.expiresAt,
      path: '/',
    });

    // HMAC-подпись
    const authSecret = process.env.AUTH_SECRET;
    if (!authSecret) {
      console.error('AUTH_SECRET not set');
      return NextResponse.json(
        { error: 'Ошибка конфигурации сервера' },
        { status: 500 }
      );
    }
    
    const sig = await signToken(session.token, authSecret);
    response.cookies.set(AUTH_SIG_COOKIE, sig, {
      httpOnly: true,
      secure: useSecureCookie,
      sameSite: 'lax',
      expires: session.expiresAt,
      path: '/',
    });

    // Cookie темы
    response.cookies.set(THEME_COOKIE_KEY, DEFAULT_THEME_PREFERENCE, {
      httpOnly: false,
      secure: useSecureCookie,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  } catch (error) {
    console.error('Verify email error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

// GET для перехода по ссылке из письма
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
  }

  // Редиректим на страницу верификации
  return NextResponse.redirect(new URL(`/verify-email?token=${token}`, request.url));
}
