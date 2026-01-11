/**
 * Helper для получения userId в API routes
 * 
 * В однопользовательском режиме (AUTH_ENABLED=false) возвращает "local-user"
 * В многопользовательском режиме (AUTH_ENABLED=true) возвращает ID из сессии
 */

import { getAuthUser } from './auth';

const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';
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
  const userId = await getUserId(request);
  
  if (!userId) {
    throw new Error('Unauthorized');
  }
  
  return userId;
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
