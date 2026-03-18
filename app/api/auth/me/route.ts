import { NextResponse } from 'next/server';
import { getAuthUser, changePassword } from '@/lib/auth';

const AUTH_ENABLED = process.env.AUTH_ENABLED !== 'false';

// Получение текущего пользователя
export async function GET(request: Request) {
  try {
    // Однопользовательский режим — возвращаем мок-пользователя
    if (!AUTH_ENABLED) {
      return NextResponse.json({
        user: { id: 'local-user', email: 'local@localhost', name: 'Local User', role: 'user', onboardingCompleted: true }
      });
    }

    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Get user API error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

// Изменение пароля
export async function PUT(request: Request) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Текущий и новый пароль обязательны' },
        { status: 400 }
      );
    }

    const result = await changePassword(user.id, currentPassword, newPassword);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // После смены пароля удаляем cookie (нужно перелогиниться)
    const response = NextResponse.json({ success: true });
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(0),
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Change password API error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
