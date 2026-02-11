import { NextResponse } from 'next/server';
import { getUserByEmail, createEmailVerificationToken } from '@/lib/auth';
import { sendEmail, getEmailVerificationContent } from '@/lib/email';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

// Rate limiter для повторной отправки
const resendRateLimiter = {
  limit: 3,
  windowMs: 15 * 60 * 1000, // 15 минут
  keyPrefix: 'resend-verification',
};

export async function POST(request: Request) {
  try {
    // Проверяем rate limit
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientId, resendRateLimiter);
    
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
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email не указан' },
        { status: 400 }
      );
    }

    // Ищем пользователя
    const user = await getUserByEmail(email);
    
    // Не раскрываем информацию о существовании пользователя
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'Если аккаунт существует, письмо отправлено',
      });
    }

    // Если email уже подтверждён
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Если аккаунт существует, письмо отправлено',
      });
    }

    // Создаём новый токен и отправляем письмо
    const token = await createEmailVerificationToken(user.id);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;
    
    const emailContent = getEmailVerificationContent(verifyUrl, user.name || undefined);
    const emailResult = await sendEmail({
      to: email,
      ...emailContent,
    });

    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      return NextResponse.json(
        { error: 'Ошибка отправки письма. Попробуйте позже.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Если аккаунт существует, письмо отправлено',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
