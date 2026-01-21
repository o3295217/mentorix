import { NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

// Rate limiter для регистрации - защита от спама
const registerRateLimiter = {
  limit: 3, // 3 попытки
  windowMs: 60 * 60 * 1000, // 1 час
  keyPrefix: 'register',
};

export async function POST(request: Request) {
  try {
    // Проверяем rate limit
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientId, registerRateLimiter);
    
    if (!rateLimit.success) {
      return NextResponse.json(
        { 
          error: 'Слишком много попыток регистрации. Попробуйте позже.',
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
    const { email, password, name, inviteCode } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email и пароль обязательны' },
        { status: 400 }
      );
    }

    // Проверяем invite code (опционально, можно включить для закрытой регистрации)
    const registrationMode = process.env.REGISTRATION_MODE || 'open';
    
    if (registrationMode === 'invite') {
      const validInviteCode = process.env.INVITE_CODE;
      if (!inviteCode || inviteCode !== validInviteCode) {
        return NextResponse.json(
          { error: 'Неверный код приглашения' },
          { status: 403 }
        );
      }
    } else if (registrationMode === 'closed') {
      // Регистрация закрыта
      return NextResponse.json(
        { error: 'Регистрация закрыта' },
        { status: 403 }
      );
    }

    // Проверяем лимит пользователей
    const maxUsers = parseInt(process.env.MAX_USERS || '0');
    if (maxUsers > 0) {
      const userCount = await prisma.user.count();
      if (userCount >= maxUsers) {
        return NextResponse.json(
          { error: 'Достигнут лимит пользователей' },
          { status: 403 }
        );
      }
    }

    const result = await registerUser(email, password, name);

    if (!result.success || !result.session) {
      return NextResponse.json(
        { error: result.error || 'Ошибка регистрации' },
        { status: 400 }
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
    console.error('Register API error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
