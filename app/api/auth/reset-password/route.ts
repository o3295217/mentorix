import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPasswordForReset as hashPassword, hashToken } from '@/lib/auth';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth-constants'
import { checkRateLimit, getClientIdentifier, rateLimiters } from '@/lib/rate-limit';

// GET - проверка валидности токена
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Токен не указан' },
        { status: 400 }
      );
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: hashToken(token) },
      include: { user: { select: { isActive: true, deletedAt: true } } },
    });

    if (!resetToken) {
      return NextResponse.json({ valid: false, error: 'Недействительная ссылка' });
    }

    if (resetToken.usedAt) {
      return NextResponse.json({ valid: false, error: 'Ссылка уже использована' });
    }

    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json({ valid: false, error: 'Ссылка истекла' });
    }

    if (!resetToken.user.isActive || resetToken.user.deletedAt) {
      return NextResponse.json({ valid: false, error: 'Аккаунт деактивирован' });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Ошибка проверки' },
      { status: 500 }
    );
  }
}

// POST - сброс пароля
export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientId, rateLimiters.auth);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Слишком много попыток. Попробуйте позже.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Токен и пароль обязательны' },
        { status: 400 }
      );
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Пароль должен быть не менее ${MIN_PASSWORD_LENGTH} символов` },
        { status: 400 }
      );
    }

    // Находим токен
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: hashToken(token) },
      include: { user: { select: { isActive: true, deletedAt: true } } },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Недействительная ссылка для сброса пароля' },
        { status: 400 }
      );
    }

    if (resetToken.usedAt) {
      return NextResponse.json(
        { error: 'Эта ссылка уже была использована' },
        { status: 400 }
      );
    }

    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Ссылка истекла. Запросите новую.' },
        { status: 400 }
      );
    }

    if (!resetToken.user.isActive || resetToken.user.deletedAt) {
      return NextResponse.json(
        { error: 'Аккаунт деактивирован' },
        { status: 400 }
      );
    }

    // Хешируем новый пароль
    const passwordHash = await hashPassword(password);

    // Транзакция: обновляем пароль и помечаем токен использованным
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Удаляем все сессии пользователя
      prisma.session.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Пароль успешно изменён. Теперь вы можете войти.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
