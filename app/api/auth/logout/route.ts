import { NextResponse } from 'next/server';
import { logoutUser, getTokenFromRequest, getAuthUser } from '@/lib/auth';
import { THEME_COOKIE_KEY } from '@/lib/theme'
import { AUTH_SIG_COOKIE } from '@/lib/hmac'
import { audit, getAuditContext } from '@/lib/audit'

export async function POST(request: Request) {
  try {
    const token = getTokenFromRequest(request);
    const user = await getAuthUser(request)
    
    if (token) {
      await logoutUser(token);
    }

    if (user) {
      audit({ userId: user.id, action: 'logout', resource: 'User', ...getAuditContext(request) })
    }

    const response = NextResponse.json({ success: true });
    
    // Удаляем cookie
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(0),
      path: '/',
    });

    // Удаляем cookie подписи
    response.cookies.set(AUTH_SIG_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
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
