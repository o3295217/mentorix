/**
 * Cloudflare Worker + Durable Object — прокси для Anthropic API
 * Worker принимает запрос → передаёт Durable Object в US → тот вызывает Anthropic
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com';

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
  const proxySecret = request.headers.get('x-proxy-secret');
  if (env.PROXY_SECRET && proxySecret !== env.PROXY_SECRET) {
    return false;
  }
  return true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Отладка
    if (url.pathname === '/debug') {
      return new Response(JSON.stringify({
        colo: request.cf?.colo,
        country: request.cf?.country,
        city: request.cf?.city,
      }, null, 2), { headers: { 'Content-Type': 'application/json' } });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': env.ALLOWED_ORIGINS || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Проверяем секрет
    if (!validateProxySecret(request, env)) {
      return new Response(JSON.stringify({ error: 'Unauthorized proxy access' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
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
      responseHeaders.set('Access-Control-Allow-Origin', env.ALLOWED_ORIGINS || '*');

      return new Response(result.body, {
        status: result.status,
        statusText: result.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Proxy error', message: error.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
