import { NextResponse } from 'next/server';
import { registerUser, createEmailVerificationToken, isEmailVerificationRequired } from '@/lib/auth';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth-constants'
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIdentifier, rateLimiters } from '@/lib/rate-limit';
import { DEFAULT_THEME_PREFERENCE, THEME_COOKIE_KEY } from '@/lib/theme'
import { signToken, AUTH_SIG_COOKIE } from '@/lib/hmac'
import { sendEmail, getEmailVerificationContent } from '@/lib/email';
import { notifyTelegram } from '@/lib/telegram';
import { audit, getAuditContext } from '@/lib/audit'
import { shouldUseSecureCookies } from '@/lib/cookie-security'
import { getAppUrl } from '@/lib/app-url'

function verificationResponse() {
  return NextResponse.json({
    success: true,
    requiresVerification: true,
    message: 'Если email доступен для регистрации, проверьте почту для подтверждения.',
  })
}

export async function POST(request: Request) {
  try {
    // Проверяем rate limit
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientId, rateLimiters.authRegistration);
    
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

    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Пароль должен быть не менее ${MIN_PASSWORD_LENGTH} символов` },
        { status: 400 }
      )
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
    const normalizedEmail = email.toLowerCase().trim()
    
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
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      const requiresVerification = isEmailVerificationRequired()

      if (requiresVerification && !existingUser.emailVerified && existingUser.isActive && !existingUser.deletedAt) {
        try {
          const token = await createEmailVerificationToken(existingUser.id)
          const appUrl = getAppUrl()
          const verifyUrl = `${appUrl}/verify-email?token=${token}`
          const emailContent = getEmailVerificationContent(verifyUrl, existingUser.name || undefined)

          await sendEmail({
            to: normalizedEmail,
            ...emailContent,
          })
        } catch (verificationError) {
          console.error('Failed to resend verification email:', verificationError)
        }
      }

      return verificationResponse()
    }

    // Проверяем лимит пользователей
    const maxUsers = parseInt(process.env.MAX_USERS || '0');
    if (maxUsers > 0) {
      const userCount = await prisma.user.count({ where: { deletedAt: null } });
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
    const result = await registerUser(normalizedEmail, password, name, {
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
      const appUrl = getAppUrl();
      const verifyUrl = `${appUrl}/verify-email?token=${token}`;
      
      const emailContent = getEmailVerificationContent(verifyUrl, name);
      const emailResult = await sendEmail({
        to: normalizedEmail,
        ...emailContent,
      });

      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error);
        // Не блокируем регистрацию, но логируем ошибку
      }

      notifyTelegram(`👤 Новая регистрация\n<b>${name || 'Без имени'}</b>\n${normalizedEmail}`);
      audit({ userId: result.userId, action: 'register', resource: 'User', details: normalizedEmail, ...getAuditContext(request) })

      return verificationResponse()
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

    notifyTelegram(`👤 Новая регистрация\n<b>${name || 'Без имени'}</b>\n${normalizedEmail}`);
    audit({ userId: result.session.user.id, action: 'register', resource: 'User', details: normalizedEmail, ...getAuditContext(request) })

    // Устанавливаем cookie
    const useSecureCookie = shouldUseSecureCookies();
    response.cookies.set('auth_token', result.session.token, {
      httpOnly: true,
      secure: useSecureCookie,
      sameSite: 'strict',
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
      sameSite: 'strict',
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
