import { afterEach, describe, expect, it, vi } from 'vitest'
import { streamTextDeltas, TextDeltaEvent } from '@/lib/streaming-text'

async function* delayedEvents(releaseSecond: Promise<void>): AsyncIterable<TextDeltaEvent> {
  yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'first chunk without newline' } }
  await releaseSecond
  yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '\nsecond' } }
}

describe('streamTextDeltas', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('emits text deltas immediately without waiting for newline or upstream close', async () => {
    let releaseSecond!: () => void
    const secondChunk = new Promise<void>((resolve) => {
      releaseSecond = resolve
    })
    const chunks: string[] = []

    const done = streamTextDeltas(delayedEvents(secondChunk), (text) => {
      chunks.push(text)
    })

    await vi.waitFor(() => {
      expect(chunks).toEqual(['first chunk without newline'])
    })

    releaseSecond()
    await expect(done).resolves.toBe('first chunk without newline\nsecond')
  })

  it('preserves markdown and exact full text for chat history', async () => {
    async function* events(): AsyncIterable<TextDeltaEvent> {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '**bold' } }
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '** and *italic*' } }
    }

    const chunks: string[] = []
    const fullText = await streamTextDeltas(events(), (text) => chunks.push(text))

    expect(chunks).toEqual(['**bold', '** and *italic*'])
    expect(fullText).toBe('**bold** and *italic*')
  })
})
