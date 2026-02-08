/**
 * HMAC-SHA256 утилиты для подписи/верификации токенов в Edge Runtime.
 *
 * Используется в middleware для проверки, что auth_token был выдан сервером,
 * без обращения к БД (crypto.subtle доступен в Edge Runtime).
 *
 * Полная валидация сессии (экспирация, активность пользователя) по-прежнему
 * выполняется в API routes через requireUserId / validateSession.
 */

const COOKIE_NAME = 'auth_token_sig';

/**
 * Подписать токен с помощью HMAC-SHA256.
 * @returns hex-строка подписи
 */
export async function signToken(token: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(token));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Проверить подпись токена.
 * @returns true если подпись совпадает
 */
export async function verifyToken(
  token: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expected = await signToken(token, secret);
  // Constant-time comparison через subtle (Edge-совместимый способ)
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

export { COOKIE_NAME as AUTH_SIG_COOKIE };
