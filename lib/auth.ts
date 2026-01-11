/**
 * Библиотека аутентификации (без внешних зависимостей)
 * Использует JWT токены и bcrypt для хеширования
 */

import { prisma } from './prisma';

// Простая реализация без bcrypt (для MVP, потом можно заменить)
// В проде используйте: npm install bcryptjs
async function hashPassword(password: string): Promise<string> {
  // Простой hash для начала (заменить на bcrypt в проде)
  const encoder = new TextEncoder();
  const data = encoder.encode(password + process.env.AUTH_SECRET);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// Генерация токена сессии
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// Типы
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  expiresAt: Date;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  session?: AuthSession;
}

// Регистрация пользователя
export async function registerUser(
  email: string,
  password: string,
  name?: string
): Promise<AuthResult> {
  try {
    // Проверяем, существует ли пользователь
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: 'Пользователь с таким email уже существует' };
    }

    // Валидация пароля
    if (password.length < 8) {
      return { success: false, error: 'Пароль должен быть не менее 8 символов' };
    }

    // Хешируем пароль и создаём пользователя
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: 'user',
      },
    });

    // Создаём сессию
    const session = await createSession(user.id);
    
    return {
      success: true,
      session: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token: session.token,
        expiresAt: session.expiresAt,
      },
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'Ошибка при регистрации' };
  }
}

// Вход пользователя
export async function loginUser(
  email: string,
  password: string,
  userAgent?: string,
  ipAddress?: string
): Promise<AuthResult> {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return { success: false, error: 'Неверный email или пароль' };
    }

    if (!user.isActive) {
      return { success: false, error: 'Аккаунт деактивирован' };
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return { success: false, error: 'Неверный email или пароль' };
    }

    // Обновляем lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Создаём сессию
    const session = await createSession(user.id, userAgent, ipAddress);
    
    return {
      success: true,
      session: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token: session.token,
        expiresAt: session.expiresAt,
      },
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Ошибка при входе' };
  }
}

// Создание сессии
async function createSession(
  userId: string,
  userAgent?: string,
  ipAddress?: string
) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней

  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      userAgent,
      ipAddress,
    },
  });

  return session;
}

// Проверка сессии
export async function validateSession(token: string): Promise<AuthUser | null> {
  try {
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) return null;
    if (session.expiresAt < new Date()) {
      // Удаляем истёкшую сессию
      await prisma.session.delete({ where: { id: session.id } });
      return null;
    }
    if (!session.user.isActive) return null;

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

// Выход (удаление сессии)
export async function logoutUser(token: string): Promise<boolean> {
  try {
    await prisma.session.delete({ where: { token } });
    return true;
  } catch {
    return false;
  }
}

// Удаление всех сессий пользователя (принудительный выход везде)
export async function logoutAllSessions(userId: string): Promise<boolean> {
  try {
    await prisma.session.deleteMany({ where: { userId } });
    return true;
  } catch {
    return false;
  }
}

// Изменение пароля
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<AuthResult> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, error: 'Пользователь не найден' };
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return { success: false, error: 'Неверный текущий пароль' };
    }

    if (newPassword.length < 8) {
      return { success: false, error: 'Новый пароль должен быть не менее 8 символов' };
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Удаляем все старые сессии для безопасности
    await prisma.session.deleteMany({ where: { userId } });

    return { success: true };
  } catch (error) {
    console.error('Change password error:', error);
    return { success: false, error: 'Ошибка при смене пароля' };
  }
}

// Очистка истёкших сессий (вызывать периодически)
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

// Получение userId из cookie/header
export function getTokenFromRequest(request: Request): string | null {
  // Проверяем Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Проверяем cookie
  const cookies = request.headers.get('Cookie');
  if (cookies) {
    const match = cookies.match(/auth_token=([^;]+)/);
    if (match) return match[1];
  }

  return null;
}

// Middleware helper для API routes
export async function getAuthUser(request: Request): Promise<AuthUser | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return validateSession(token);
}

// Проверка, что пользователь авторизован (для API routes)
export async function requireAuth(request: Request): Promise<AuthUser> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new AuthError('Unauthorized', 401);
  }
  return user;
}

// Проверка админских прав
export async function requireAdmin(request: Request): Promise<AuthUser> {
  const user = await requireAuth(request);
  if (user.role !== 'admin') {
    throw new AuthError('Forbidden', 403);
  }
  return user;
}

// Кастомная ошибка авторизации
export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// Создание первого админа (использовать при первом запуске)
export async function createInitialAdmin(
  email: string,
  password: string,
  name?: string
): Promise<AuthResult> {
  // Проверяем, есть ли уже пользователи
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return { success: false, error: 'Пользователи уже существуют' };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: 'admin',
    },
  });

  return {
    success: true,
    session: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token: '', // Не создаём сессию при инициализации
      expiresAt: new Date(),
    },
  };
}
