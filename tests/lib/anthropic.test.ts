import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const anthropicConstructor = vi.fn(function AnthropicMock(this: { options?: unknown }, options: unknown) {
  this.options = options
})

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('ANTHROPIC_API_KEY', '')
  vi.stubEnv('AI_MODEL', '')
  vi.doMock('@anthropic-ai/sdk', () => ({ default: anthropicConstructor }))
  anthropicConstructor.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.doUnmock('@anthropic-ai/sdk')
})

describe('getAnthropicClient', () => {
  it('requires an API key', async () => {
    const { getAnthropicClient } = await import('@/lib/anthropic')

    expect(() => getAnthropicClient()).toThrow(/ANTHROPIC_API_KEY/)
  })

  it('configures proxy URL and secret headers when provided', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-api-key')
    vi.stubEnv('ANTHROPIC_PROXY_URL', 'https://proxy.example.com')
    vi.stubEnv('ANTHROPIC_PROXY_SECRET', 'proxy-secret')

    const { getAnthropicClient } = await import('@/lib/anthropic')
    const client = getAnthropicClient()

    expect(anthropicConstructor).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      maxRetries: 2,
      timeout: 5 * 60 * 1000,
      baseURL: 'https://proxy.example.com',
      defaultHeaders: { 'x-proxy-secret': 'proxy-secret' },
    })
    expect(getAnthropicClient()).toBe(client)
    expect(anthropicConstructor).toHaveBeenCalledTimes(1)
  })
})

describe('getAiModel', () => {
  it('returns fallback model when AI_MODEL is empty', async () => {
    const { DEFAULT_AI_MODEL, DEFAULT_ROUTE_AI_MODEL, getAiModel } = await import('@/lib/anthropic')

    expect(getAiModel()).toBe(DEFAULT_AI_MODEL)
    expect(getAiModel(DEFAULT_ROUTE_AI_MODEL)).toBe(DEFAULT_ROUTE_AI_MODEL)
  })

  it('trims and returns AI_MODEL when configured', async () => {
    vi.stubEnv('AI_MODEL', '  claude-custom-model  ')
    const { DEFAULT_ROUTE_AI_MODEL, getAiModel } = await import('@/lib/anthropic')

    expect(getAiModel(DEFAULT_ROUTE_AI_MODEL)).toBe('claude-custom-model')
  })
})