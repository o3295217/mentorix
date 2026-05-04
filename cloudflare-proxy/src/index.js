/**
 * Cloudflare Worker + Durable Object — прокси для Anthropic API
 * Worker принимает запрос → передаёт Durable Object в US → тот вызывает Anthropic
 */

const DEFAULT_ANTHROPIC_API_URL = 'https://api.anthropic.com';
const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function getAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getCorsOrigin(request, env) {
  const requestOrigin = request.headers.get('origin');
  const allowedOrigins = getAllowedOrigins(env);

  if (!requestOrigin) {
    return allowedOrigins[0] || null;
  }

  return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
}

function buildCorsHeaders(request, env) {
  const origin = getCorsOrigin(request, env);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type,x-api-key,anthropic-version,anthropic-beta,x-proxy-secret',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

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

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

function getRateLimit(env) {
  const parsed = Number(env.RATE_LIMIT_PER_MINUTE || DEFAULT_RATE_LIMIT_PER_MINUTE);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_RATE_LIMIT_PER_MINUTE;
}

function getAnthropicApiUrl(env) {
  const rawUrl = String(env.ANTHROPIC_API_URL || DEFAULT_ANTHROPIC_API_URL).trim();
  return rawUrl.replace(/\/+$/, '') || DEFAULT_ANTHROPIC_API_URL;
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

// ============================
// DURABLE OBJECT — запускается в US (wnam)
// ============================
export class AnthropicProxyDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const { method, pathname, search, headers: headersList, body } = await request.json();

    const cleanHeaders = new Headers();
    for (const [key, value] of Object.entries(headersList)) {
      cleanHeaders.set(key, value);
    }

    const anthropicUrl = getAnthropicApiUrl(this.env) + pathname + (search || '');

    const response = await fetch(anthropicUrl, {
      method,
      headers: cleanHeaders,
      body: body || undefined,
    });

    const responseBody = await response.text();
    return new Response(JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ============================
// WORKER — входная точка
// ============================
function validateProxySecret(request, env) {
  if (!env.PROXY_SECRET) {
    return { status: 503, payload: { error: 'Proxy not configured' } };
  }

  const proxySecret = request.headers.get('x-proxy-secret');
  if (proxySecret !== env.PROXY_SECRET) {
    return { status: 403, payload: { error: 'Forbidden' } };
  }

  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = buildCorsHeaders(request, env);

    if (request.headers.get('origin') && !corsHeaders['Access-Control-Allow-Origin']) {
      return new Response('Forbidden', {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Отладочный эндпоинт отключён
    if (url.pathname === '/debug') {
      return new Response('Not found', { status: 404, headers: corsHeaders });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    // Проверяем секрет
    const authError = validateProxySecret(request, env);
    if (authError) {
      return jsonResponse(authError.payload, { status: authError.status, headers: corsHeaders });
    }

    const rateLimit = await checkRateLimit(request, env, 'anthropic-proxy');
    if (!rateLimit.allowed) {
      return jsonResponse(
        { error: rateLimit.error || 'Too Many Requests', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { ...corsHeaders, 'Retry-After': String(rateLimit.retryAfter || 60) } }
      );
    }

    // Собираем заголовки для Anthropic
    const headersList = {};
    const apiKey = request.headers.get('x-api-key');
    if (apiKey) headersList['x-api-key'] = apiKey;
    const anthropicVersion = request.headers.get('anthropic-version');
    if (anthropicVersion) headersList['anthropic-version'] = anthropicVersion;
    headersList['content-type'] = 'application/json';
    const anthropicBeta = request.headers.get('anthropic-beta');
    if (anthropicBeta) headersList['anthropic-beta'] = anthropicBeta;

    // Читаем тело
    let body = null;
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      body = await request.text();
    }

    try {
      // Вызываем Durable Object с location hint "wnam" (Western North America)
      const id = env.ANTHROPIC_PROXY.idFromName('proxy-singleton');
      const stub = env.ANTHROPIC_PROXY.get(id, { locationHint: 'wnam' });

      const doResponse = await stub.fetch(new Request('https://do-internal/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: request.method,
          pathname: url.pathname,
          search: url.search,
          headers: headersList,
          body: body,
        }),
      }));

      const result = await doResponse.json();

      // Формируем ответ клиенту
      const responseHeaders = new Headers();
      for (const [key, value] of Object.entries(result.headers || {})) {
        responseHeaders.set(key, value);
      }
      for (const [key, value] of Object.entries(corsHeaders)) {
        responseHeaders.set(key, value);
      }

      return new Response(result.body, {
        status: result.status,
        statusText: result.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      return jsonResponse({ error: 'Proxy error', message: error.message }, {
        status: 502,
        headers: corsHeaders,
      });
    }
  },
};
