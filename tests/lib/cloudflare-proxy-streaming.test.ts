import { afterEach, describe, expect, it, vi } from 'vitest'
import worker, { proxyAnthropicRequest } from '@/cloudflare-proxy/src/index.js'

async function readFirstChunk(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is missing')
  const { value } = await reader.read()
  return new TextDecoder().decode(value)
}

function createStreamingResponse(status = 202): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('first'))
      setTimeout(() => {
        controller.enqueue(encoder.encode('second'))
        controller.close()
      }, 50)
    },
  })

  return new Response(stream, {
    status,
    statusText: 'Accepted',
    headers: {
      'Content-Type': 'text/event-stream',
      'anthropic-request-id': 'req_test',
    },
  })
}

describe('cloudflare anthropic proxy streaming', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('proxyAnthropicRequest passes upstream body through without buffering', async () => {
    let proxiedBody = ''
    const response = await proxyAnthropicRequest(
      new Request('https://proxy.example/v1/messages', {
        method: 'POST',
        body: JSON.stringify({ stream: true }),
      }),
      { ANTHROPIC_API_URL: 'https://api.example' },
      async (_url: URL | RequestInfo, init?: RequestInit) => {
        proxiedBody = await new Response(init?.body).text()
        return createStreamingResponse()
      }
    )

    expect(proxiedBody).toBe('{"stream":true}')
    expect(response.status).toBe(202)
    expect(response.headers.get('Content-Type')).toContain('text/event-stream')
    await expect(readFirstChunk(response)).resolves.toBe('first')
  })

  it('worker preserves status and headers from Durable Object streaming response', async () => {
    const env = {
      PROXY_SECRET: 'secret',
      RATE_LIMITER: {
        idFromName: () => 'rate-id',
        get: () => ({
          fetch: async () => Response.json({ allowed: true, retryAfter: 1 }),
        }),
      },
      ANTHROPIC_PROXY: {
        idFromName: () => 'proxy-id',
        get: () => ({
          fetch: async () => createStreamingResponse(206),
        }),
      },
    }

    const response = await worker.fetch(new Request('https://proxy.example/v1/messages', {
      method: 'POST',
      headers: {
        'x-proxy-secret': 'secret',
        origin: 'https://app.example',
      },
      body: JSON.stringify({ stream: true }),
    }), {
      ...env,
      ALLOWED_ORIGINS: 'https://app.example',
    })

    expect(response.status).toBe(206)
    expect(response.headers.get('Content-Type')).toContain('text/event-stream')
    expect(response.headers.get('anthropic-request-id')).toBe('req_test')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example')
    await expect(readFirstChunk(response)).resolves.toBe('first')
  })
})
