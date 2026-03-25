import { NextResponse } from 'next/server';
import { registerUser, createEmailVerificationToken, isEmailVerificationRequired } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { DEFAULT_THEME_PREFERENCE, THEME_COOKIE_KEY } from '@/lib/theme'
import { signToken, AUTH_SIG_COOKIE } from '@/lib/hmac'
import { sendEmail, getEmailVerificationContent } from '@/lib/email';

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
    const { email, password, name, inviteCode } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email и пароль обязательны' },
        { status: 400 }
      );
    }

    // Валидация формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Некорректный формат email' },
        { status: 400 }
      );
    }

    // Блокировка заведомо невалидных/тестовых доменов
    const blockedDomains = [
      'example.com', 'example.org', 'example.net',
      'test.com', 'test.org', 'localhost',
      'mailinator.com', 'tempmail.com', 'throwaway.email',
      'guerrillamail.com', 'sharklasers.com', 'guerrillamailblock.com',
      'yopmail.com', 'trashmail.com', 'fakeinbox.com',
    ];
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (!emailDomain || blockedDomains.includes(emailDomain)) {
      return NextResponse.json(
        { error: 'Регистрация с этого домена email невозможна' },
        { status: 400 }
      );
    }

    const registrationMode = process.env.REGISTRATION_MODE || 'open';
    
    // Проверяем invite code для режима invite
    if (registrationMode === 'invite') {
      const validInviteCode = process.env.INVITE_CODE;
      if (!inviteCode || inviteCode !== validInviteCode) {
        return NextResponse.json(
          { error: 'Неверный код приглашения' },
          { status: 403 }
        );
      }
    } else if (registrationMode === 'closed') {
      return NextResponse.json(
        { error: 'Регистрация закрыта' },
        { status: 403 }
      );
    }

    // Проверяем, существует ли пользователь (до проверки лимита)
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Пользователь с таким email уже зарегистрирован', code: 'USER_EXISTS' },
        { status: 409 }
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

    // Определяем, нужна ли верификация email
    const requiresVerification = isEmailVerificationRequired();
    
    // При режиме invite — сразу верифицируем email
    const emailVerified = registrationMode === 'invite';
    
    // Регистрируем пользователя
    const result = await registerUser(email, password, name, {
      skipSession: requiresVerification && !emailVerified,
      emailVerified,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Ошибка регистрации' },
        { status: 400 }
      );
    }

    // Если нужна верификация — отправляем письмо
    if (requiresVerification && !emailVerified && result.userId) {
      const token = await createEmailVerificationToken(result.userId);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const verifyUrl = `${appUrl}/verify-email?token=${token}`;
      
      const emailContent = getEmailVerificationContent(verifyUrl, name);
      const emailResult = await sendEmail({
        to: email,
        ...emailContent,
      });

      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error);
        // Не блокируем регистрацию, но логируем ошибку
      }

      return NextResponse.json({
        success: true,
        requiresVerification: true,
        message: 'Проверьте почту для подтверждения email',
      });
    }

    // Сессия создана — устанавливаем cookies
    if (!result.session) {
      return NextResponse.json(
        { error: 'Ошибка создания сессии' },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: result.session.user,
    });

    // Устанавливаем cookie
    const useSecureCookie = process.env.COOKIE_SECURE === 'true';
    response.cookies.set('auth_token', result.session.token, {
      httpOnly: true,
      secure: useSecureCookie,
      sameSite: 'lax',
      expires: result.session.expiresAt,
      path: '/',
    });

    // HMAC-подпись токена
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
    console.error('Register API error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
