/**
 * Cloudflare Worker + Durable Object — прокси для Anthropic API
 * Worker принимает запрос → передаёт Durable Object в US → тот вызывает Anthropic
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com';

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

    const anthropicUrl = ANTHROPIC_API_URL + pathname + (search || '');

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
