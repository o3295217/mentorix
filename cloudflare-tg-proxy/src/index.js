/**
 * Dormant Cloudflare Worker fallback for Telegram Bot API.
 * Current production calls api.telegram.org directly and does not deploy this Worker.
 */

const DEFAULT_TELEGRAM_API_URL = 'https://api.telegram.org';
const DEFAULT_RATE_LIMIT_PER_MINUTE = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

function isWorkerEnabled(env) {
  return String(env.WORKER_ENABLED || 'false').trim() === 'true';
}

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

function getRateLimit(env) {
  const parsed = Number(env.RATE_LIMIT_PER_MINUTE || DEFAULT_RATE_LIMIT_PER_MINUTE);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_RATE_LIMIT_PER_MINUTE;
}

function getTelegramApiUrl(env) {
  const rawUrl = String(env.TELEGRAM_API_URL || DEFAULT_TELEGRAM_API_URL).trim();
  return rawUrl.replace(/\/+$/, '') || DEFAULT_TELEGRAM_API_URL;
}

export function buildTelegramHeaders(request) {
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const accept = request.headers.get('accept');
  if (accept) headers.set('accept', accept);
  return headers;
}

function validateProxySecret(request, env) {
  if (!env.TG_PROXY_SECRET) {
    return { status: 503, payload: { error: 'Proxy not configured' } };
  }

  const proxySecret = request.headers.get('x-tg-proxy-secret');
  if (proxySecret !== env.TG_PROXY_SECRET) {
    return { status: 403, payload: { error: 'Forbidden' } };
  }

  return null;
}

async function checkRateLimit(request, env, namespace) {
  if (!env.RATE_LIMITER) {
    return { allowed: false, retryAfter: 60, error: 'Rate limiter not configured' };
  }

  const id = env.RATE_LIMITER.idFromName(namespace);
  const stub = env.RATE_LIMITER.get(id);
  const response = await stub.fetch('https://rate-limit/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: getClientIp(request),
      limit: getRateLimit(env),
      windowMs: RATE_LIMIT_WINDOW_MS,
    }),
  });

  return response.json();
}

export async function proxyTelegramRequest(request, env, fetchImpl = fetch) {
  const url = new URL(request.url);
  const telegramUrl = getTelegramApiUrl(env) + url.pathname + url.search;

  return fetchImpl(telegramUrl, {
    method: request.method,
    headers: buildTelegramHeaders(request),
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    duplex: 'half',
  });
}

export class RateLimitDO {
  constructor() {
    this.buckets = new Map();
    this.lastCleanup = 0;
  }

  async fetch(request) {
    const { key, limit, windowMs } = await request.json();
    const now = Date.now();
    const bucket = Math.floor(now / windowMs);
    const bucketKey = `${key}:${bucket}`;

    if (now - this.lastCleanup > windowMs) {
      for (const existingKey of this.buckets.keys()) {
        const existingBucket = Number(existingKey.split(':').pop());
        if (existingBucket < bucket) this.buckets.delete(existingKey);
      }
      this.lastCleanup = now;
    }

    const count = (this.buckets.get(bucketKey) || 0) + 1;
    this.buckets.set(bucketKey, count);

    const retryAfter = Math.max(1, Math.ceil(((bucket + 1) * windowMs - now) / 1000));
    return jsonResponse({
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfter,
    }, {
      status: count <= limit ? 200 : 429,
      headers: { 'Retry-After': String(retryAfter) },
    });
  }
}

export async function handleTelegramProxyRequest(request, env, fetchImpl = fetch) {
  if (!isWorkerEnabled(env)) {
    return jsonResponse(
      { error: 'Worker disabled', message: 'Telegram proxy worker is dormant and not part of production.' },
      { status: 503 }
    );
  }

  if (new URL(request.url).pathname === '/debug') {
    return new Response('Not found', { status: 404 });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type,x-tg-proxy-secret',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const authError = validateProxySecret(request, env);
  if (authError) {
    return jsonResponse(authError.payload, { status: authError.status });
  }

  const rateLimit = await checkRateLimit(request, env, 'tg-proxy');
  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: rateLimit.error || 'Too Many Requests', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter || 60) } }
    );
  }

  try {
    const response = await proxyTelegramRequest(request, env, fetchImpl);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    return jsonResponse({ error: 'Proxy error', message: error.message }, { status: 502 });
  }
}

export default {
  async fetch(request, env) {
    return handleTelegramProxyRequest(request, env);
  },
};
