import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import worker, { handleTelegramProxyRequest, proxyTelegramRequest } from '@/cloudflare-tg-proxy/src/index.js'

const root = process.cwd()

describe('cloudflare telegram proxy dormant fallback', () => {
  it('worker is disabled by default and does not touch auth, rate limit or upstream bindings', async () => {
    const response = await worker.fetch(new Request('https://tg-proxy.example/botTOKEN/sendMessage', {
      method: 'POST',
      headers: { 'x-tg-proxy-secret': 'wrong-secret' },
      body: new URLSearchParams({ chat_id: '1', text: 'hello' }),
    }), {
      TG_PROXY_SECRET: 'real-secret',
      RATE_LIMITER: {
        idFromName: () => {
          throw new Error('rate limiter should not be called while worker is disabled')
        },
      },
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ error: 'Worker disabled' })
  })

  it('wrangler config keeps the archived worker disabled by default', async () => {
    const wrangler = await readFile(join(root, 'cloudflare-tg-proxy/wrangler.toml'), 'utf8')

    expect(wrangler).toContain('WORKER_ENABLED = "false"')
  })

  it('keeps the archived proxy helper available with an explicit safe header allowlist', async () => {
    let proxiedUrl = ''
    let proxiedBody = ''
    let proxiedHeaders = new Headers()
    const response = await proxyTelegramRequest(
      new Request('https://tg-proxy.example/botTOKEN/sendMessage', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
          'x-tg-proxy-secret': 'secret',
          cookie: 'session=secret',
          authorization: 'Bearer secret',
          'cf-connecting-ip': '203.0.113.1',
        },
        body: 'chat_id=1&text=hello',
      }),
      { TELEGRAM_API_URL: 'https://api.example' },
      async (url: URL | RequestInfo, init?: RequestInit) => {
        proxiedUrl = String(url)
        proxiedBody = await new Response(init?.body).text()
        proxiedHeaders = new Headers(init?.headers)
        return Response.json({ ok: true })
      }
    )

    expect(proxiedUrl).toBe('https://api.example/botTOKEN/sendMessage')
    expect(proxiedBody).toBe('chat_id=1&text=hello')
    expect(proxiedHeaders.get('content-type')).toBe('application/x-www-form-urlencoded')
    expect(proxiedHeaders.get('accept')).toBe('application/json')
    expect(proxiedHeaders.has('x-tg-proxy-secret')).toBe(false)
    expect(proxiedHeaders.has('cookie')).toBe(false)
    expect(proxiedHeaders.has('authorization')).toBe(false)
    expect(proxiedHeaders.has('cf-connecting-ip')).toBe(false)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it('enabled handler with valid secret proxies to Telegram without leaking sensitive headers', async () => {
    let proxiedUrl = ''
    let proxiedBody = ''
    let proxiedHeaders = new Headers()
    const response = await handleTelegramProxyRequest(
      new Request('https://tg-proxy.example/botTOKEN/sendMessage?disable_notification=true', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'x-tg-proxy-secret': 'real-secret',
          cookie: 'session=secret',
          authorization: 'Bearer secret',
          'cf-ray': 'secret-ray',
        },
        body: JSON.stringify({ chat_id: 1, text: 'hello' }),
      }),
      {
        WORKER_ENABLED: 'true',
        TG_PROXY_SECRET: 'real-secret',
        TELEGRAM_API_URL: 'https://api.telegram.test',
        RATE_LIMITER: {
          idFromName: () => 'rate-id',
          get: () => ({
            fetch: async () => Response.json({ allowed: true, retryAfter: 1 }),
          }),
        },
      },
      async (url: URL | RequestInfo, init?: RequestInit) => {
        proxiedUrl = String(url)
        proxiedBody = await new Response(init?.body).text()
        proxiedHeaders = new Headers(init?.headers)
        return Response.json({ ok: true })
      }
    )

    expect(response.status).toBe(200)
    expect(proxiedUrl).toBe('https://api.telegram.test/botTOKEN/sendMessage?disable_notification=true')
    expect(proxiedBody).toBe('{"chat_id":1,"text":"hello"}')
    expect(proxiedHeaders.get('content-type')).toBe('application/json')
    expect(proxiedHeaders.get('accept')).toBe('application/json')
    for (const forbidden of ['x-tg-proxy-secret', 'cookie', 'authorization', 'cf-ray']) {
      expect(proxiedHeaders.has(forbidden), `${forbidden} must not be forwarded`).toBe(false)
    }
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it('preserves GET requests without forwarding a body', async () => {
    let hasBody = true
    await proxyTelegramRequest(
      new Request('https://tg-proxy.example/botTOKEN/getUpdates?offset=1', { method: 'GET' }),
      { TELEGRAM_API_URL: 'https://api.example' },
      async (_url: URL | RequestInfo, init?: RequestInit) => {
        hasBody = init?.body !== undefined
        return Response.json({ ok: true })
      }
    )

    expect(hasBody).toBe(false)
  })
})
