/**
 * Библиотека аутентификации
 * Использует opaque session tokens, HMAC-подпись cookie для middleware
 * и bcrypt для хеширования паролей. JWT не используется.
 */

import bcrypt from 'bcrypt';
import { createHash, timingSafeEqual } from 'node:crypto';
import { prisma } from './prisma';
import { setAuditContext } from './prisma-audit';
import { getAuditContext } from './audit';

const BCRYPT_ROUNDS = 12;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isTimingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Хеширование пароля через bcrypt с salt
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Legacy SHA-256 хеш (только для миграции существующих паролей)
 */
async function legacySha256Hash(password: string): Promise<string> {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    throw new Error('AUTH_SECRET environment variable is required for legacy password verification');
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(password + authSecret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Проверка пароля с прозрачной миграцией legacy SHA-256 → bcrypt.
 * Если хеш старого формата и пароль верный — перехешируем на bcrypt.
 */
async function verifyPassword(
  password: string,
  hash: string,
  userId?: string
): Promise<boolean> {
  // bcrypt хеши начинаются с $2a$ / $2b$
  if (hash.startsWith('$2')) {
    return bcrypt.compare(password, hash);
  }

  // Legacy SHA-256: проверяем и мигрируем
  const legacyHash = await legacySha256Hash(password);
  if (!isTimingSafeStringEqual(legacyHash, hash)) return false;

  // Пароль верный — перехешируем на bcrypt
  if (userId) {
    const newHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    }).catch(err => console.error('Failed to migrate password hash:', err));
  }

  return true;
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
  themePreference?: string;
  onboardingCompleted?: boolean;
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

// Расширенный результат регистрации
export interface RegisterResult extends AuthResult {
  userId?: string;
  requiresVerification?: boolean;
}

// Регистрация пользователя
export async function registerUser(
  email: string,
  password: string,
  name?: string,
  options?: { skipSession?: boolean; emailVerified?: boolean }
): Promise<RegisterResult> {
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
    const emailVerified = options?.emailVerified ?? false;
    
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: 'user',
        emailVerified,
      },
    });

    // Если нужна верификация — не создаём сессию
    if (options?.skipSession) {
      return {
        success: true,
        userId: user.id,
        requiresVerification: true,
      };
    }

    // Создаём сессию
    const session = await createSession(user.id);
    
    return {
      success: true,
      userId: user.id,
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

import { recordFailedLogin, getAccountLockout, resetFailedLogins } from './rate-limit'
import { notifyTelegram } from './telegram'

/**
 * Проверяет, был ли ранее логин с этого IP.
 * Если нет — шлёт алерт в Telegram (fire-and-forget).
 */
function checkNewLoginIp(userId: string, email: string, name: string | null, ipAddress: string) {
  prisma.session.findFirst({
    where: { userId, ipAddress },
    select: { id: true },
  }).then(existing => {
    if (!existing) {
      notifyTelegram(
        `🌐 Вход с нового IP\n<b>${name || email}</b>\nIP: <code>${ipAddress}</code>`,
        `new-ip:${userId}:${ipAddress}`
      )
    }
  }).catch(() => {})
}

// Вход пользователя
export async function loginUser(
  email: string,
  password: string,
  userAgent?: string,
  ipAddress?: string
): Promise<AuthResult & { emailNotVerified?: boolean }> {
  try {
    // Проверяем блокировку аккаунта
    const lockoutSeconds = getAccountLockout(email)
    if (lockoutSeconds > 0) {
      return { success: false, error: `Аккаунт временно заблокирован. Попробуйте через ${Math.ceil(lockoutSeconds / 60)} мин.` }
    }

    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      const { locked, attempts } = recordFailedLogin(email)
      if (locked) {
        notifyTelegram(`🔒 Аккаунт заблокирован (10 неудачных попыток)\n<b>${email}</b>\nIP: ${ipAddress || 'unknown'}`)
      } else if (attempts === 3) {
        notifyTelegram(`⚠️ 3 неудачных попытки входа\n<b>${email}</b>\nIP: ${ipAddress || 'unknown'}`, `failed-3:${email}`)
      }
      return { success: false, error: 'Неверный email или пароль' };
    }

    if (!user.isActive || user.deletedAt) {
      return { success: false, error: 'Аккаунт деактивирован' };
    }

    const isValid = await verifyPassword(password, user.passwordHash, user.id);
    if (!isValid) {
      const { locked, attempts } = recordFailedLogin(email)
      if (locked) {
        notifyTelegram(`🔒 Аккаунт заблокирован (10 неудачных попыток)\n<b>${email}</b>\nIP: ${ipAddress || 'unknown'}`)
      } else if (attempts === 3) {
        notifyTelegram(`⚠️ 3 неудачных попытки входа\n<b>${email}</b>\nIP: ${ipAddress || 'unknown'}`, `failed-3:${email}`)
      }
      return { success: false, error: 'Неверный email или пароль' };
    }

    // Успешный вход — сбрасываем счётчик
    resetFailedLogins(email)

    // Проверяем верификацию email (только если включена в настройках)
    if (isEmailVerificationRequired() && !user.emailVerified) {
      return { 
        success: false, 
        error: 'Email не подтверждён. Проверьте почту или запросите письмо повторно.',
        emailNotVerified: true,
      };
    }

    // Обновляем lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Создаём сессию
    const session = await createSession(user.id, userAgent, ipAddress);

    // Алерт при логине с нового IP
    if (ipAddress) {
      checkNewLoginIp(user.id, user.email, user.name, ipAddress)
    }
    
    return {
      success: true,
      session: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          themePreference: user.themePreference,
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

// Создание сессии (экспортируется для использования после верификации email)
export async function createSession(
  userId: string,
  userAgent?: string,
  ipAddress?: string
) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней

  await prisma.session.create({
    data: {
      userId,
      token: hashToken(token),
      expiresAt,
      userAgent,
      ipAddress,
    },
  });

  return { token, expiresAt };
}

// Получить пользователя по ID (для создания сессии после верификации)
export async function getUserById(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive || user.deletedAt) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    themePreference: user.themePreference,
  };
}

// Получить пользователя по email (для повторной отправки верификации)
export async function getUserByEmail(email: string): Promise<{ id: string; name: string | null; emailVerified: boolean } | null> {
  const user = await prisma.user.findUnique({ 
    where: { email },
    select: { id: true, name: true, emailVerified: true, isActive: true, deletedAt: true }
  });
  if (!user || !user.isActive || user.deletedAt) return null;
  return { id: user.id, name: user.name, emailVerified: user.emailVerified };
}

// Проверка сессии
export async function validateSession(token: string): Promise<AuthUser | null> {
  try {
    const session = await prisma.session.findUnique({
      where: { token: hashToken(token) },
      include: { user: true },
    });

    if (!session) return null;
    if (session.expiresAt < new Date()) {
      // Удаляем истёкшую сессию
      await prisma.session.delete({ where: { id: session.id } });
      return null;
    }
    if (!session.user.isActive || session.user.deletedAt) return null;

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      onboardingCompleted: session.user.onboardingCompleted,
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

// Выход (удаление сессии)
export async function logoutUser(token: string): Promise<boolean> {
  try {
    const result = await prisma.session.deleteMany({
      where: { token: hashToken(token) },
    });
    return result.count > 0;
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
    if (!user || !user.isActive || user.deletedAt) {
      return { success: false, error: 'Пользователь не найден' };
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash, user.id);
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
  const user = await validateSession(token);
  if (user) {
    const { ipAddress, userAgent } = getAuditContext(request)
    setAuditContext({ userId: user.id, ipAddress, userAgent })
  }
  return user;
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

// Сброс пароля (для админа или CLI)
export async function resetPassword(
  email: string,
  newPassword: string
): Promise<AuthResult> {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || user.deletedAt) {
      return { success: false, error: 'Пользователь не найден' };
    }

    if (newPassword.length < 8) {
      return { success: false, error: 'Пароль должен быть не менее 8 символов' };
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Удаляем все сессии пользователя
    await prisma.session.deleteMany({ where: { userId: user.id } });

    return { success: true };
  } catch (error) {
    console.error('Reset password error:', error);
    return { success: false, error: 'Ошибка при сбросе пароля' };
  }
}

// Хэширование пароля (экспорт для CLI и API)
export async function hashPasswordForReset(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// ==================== EMAIL VERIFICATION ====================

/**
 * Генерация токена для верификации email
 */
export async function createEmailVerificationToken(userId: string): Promise<string> {
  // Удаляем старые неиспользованные токены
  await prisma.emailVerificationToken.deleteMany({
    where: {
      userId,
      usedAt: null,
    },
  });

  // Генерируем новый токен (64 символа hex)
  const tokenArray = new Uint8Array(32);
  crypto.getRandomValues(tokenArray);
  const token = Array.from(tokenArray, b => b.toString(16).padStart(2, '0')).join('');

  // Токен действителен 24 часа
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      token: hashToken(token),
      expiresAt,
    },
  });

  return token;
}

/**
 * Верификация email по токену
 */
export async function verifyEmailToken(token: string): Promise<{
  success: boolean;
  error?: string;
  userId?: string;
}> {
  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { token: hashToken(token) },
    include: { user: true },
  });

  if (!verificationToken) {
    return { success: false, error: 'Неверная ссылка для подтверждения' };
  }

  if (verificationToken.usedAt) {
    return { success: false, error: 'Ссылка уже была использована' };
  }

  if (verificationToken.expiresAt < new Date()) {
    return { success: false, error: 'Срок действия ссылки истёк. Запросите новую.' };
  }

  if (!verificationToken.user.isActive || verificationToken.user.deletedAt) {
    return { success: false, error: 'Аккаунт деактивирован' };
  }

  // Помечаем токен как использованный и верифицируем email
  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true },
    }),
  ]);

  return { success: true, userId: verificationToken.userId };
}

/**
 * Проверяет, нужна ли верификация email (для текущего режима работы)
 */
export function isEmailVerificationRequired(): boolean {
  // Если регистрация открыта и SKIP_EMAIL_VERIFICATION не установлен — верификация обязательна
  const registrationMode = process.env.REGISTRATION_MODE || 'open';
  const skipVerification = process.env.SKIP_EMAIL_VERIFICATION === 'true';
  
  // При закрытой регистрации или режиме invite — верификация не нужна
  if (registrationMode === 'closed' || registrationMode === 'invite') {
    return false;
  }
  
  return !skipVerification;
}

// Создание первого админа (использовать при первом запуске)
export async function createInitialAdmin(
  email: string,
  password: string,
  name?: string
): Promise<AuthResult> {
  // Проверяем, есть ли уже пользователи
  const userCount = await prisma.user.count({ where: { deletedAt: null } });
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
