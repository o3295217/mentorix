import { NextResponse } from 'next/server';
import { logoutUser, getTokenFromRequest } from '@/lib/auth';
import { THEME_COOKIE_KEY } from '@/lib/theme'

export async function POST(request: Request) {
  try {
    const token = getTokenFromRequest(request);
    
    if (token) {
      await logoutUser(token);
    }

    const response = NextResponse.json({ success: true });
    
    // Удаляем cookie
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(0),
      path: '/',
    });

    // Удаляем cookie темы
    response.cookies.set(THEME_COOKIE_KEY, '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(0),
      path: '/',
    })

    return response;
  } catch (error) {
    console.error('Logout API error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
