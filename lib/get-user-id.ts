/**
 * Helper для получения userId в API routes
 * 
 * В однопользовательском режиме (AUTH_ENABLED=false) возвращает "local-user"
 * В многопользовательском режиме (по умолчанию) возвращает ID из сессии
 */

import { getAuthUser, requireAuth } from './auth';

// По умолчанию авторизация включена, отключается только AUTH_ENABLED=false
const AUTH_ENABLED = process.env.AUTH_ENABLED !== 'false';
const LOCAL_USER_ID = 'local-user';

/**
 * Получить userId для API route
 * @param request - Request объект
 * @returns userId или null если не авторизован
 */
export async function getUserId(request: Request): Promise<string | null> {
  // Однопользовательский режим
  if (!AUTH_ENABLED) {
    return LOCAL_USER_ID;
  }

  // Многопользовательский режим
  const user = await getAuthUser(request);
  return user?.id ?? null;
}

/**
 * Получить userId или выбросить ошибку
 * Для использования в защищённых routes
 */
export async function requireUserId(request: Request): Promise<string> {
  // Однопользовательский режим
  if (!AUTH_ENABLED) {
    return LOCAL_USER_ID;
  }

  // Многопользовательский режим: возвращаем userId или бросаем AuthError(401)
  const user = await requireAuth(request);
  return user.id;
}

/**
 * Проверка, включён ли режим авторизации
 */
export function isAuthEnabled(): boolean {
  return AUTH_ENABLED;
}

/**
 * ID локального пользователя (для миграции данных)
 */
export const LOCAL_USER = LOCAL_USER_ID;
