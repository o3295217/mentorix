import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail, getPasswordResetEmailContent } from '@/lib/email';
import { checkRateLimit, getClientIdentifier, rateLimiters } from '@/lib/rate-limit';

// Генерация токена
function generateResetToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientId, rateLimiters.authRecovery);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Слишком много запросов. Попробуйте позже.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email обязателен' },
        { status: 400 }
      );
    }

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Всегда отвечаем успехом (не раскрываем существование email)
    const successMessage = 'Если аккаунт существует, на указанный email отправлена ссылка для сброса пароля';

    if (!user) {
      // Не раскрываем, что пользователь не найден
      return NextResponse.json({ message: successMessage });
    }

    if (!user.isActive) {
      return NextResponse.json({ message: successMessage });
    }

    // Удаляем старые неиспользованные токены
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    });

    // Создаём новый токен
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 час

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Формируем ссылку
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Отправляем email
    const emailContent = getPasswordResetEmailContent(resetUrl, user.name || undefined);
    const emailResult = await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    if (!emailResult.success) {
      console.error('Failed to send reset email:', emailResult.error);
      // Всё равно отвечаем успехом (безопасность)
    }

    return NextResponse.json({ message: successMessage });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
