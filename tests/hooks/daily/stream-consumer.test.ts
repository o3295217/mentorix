import { describe, expect, it } from 'vitest'
import { consumeDailyChatSseStream, consumeTextStream, DailyChatSseError } from '@/hooks/daily/stream-consumer'

function createGate() {
  let openGate: () => void = () => undefined
  const promise = new Promise<void>(resolve => {
    openGate = resolve
  })

  return { open: openGate, promise }
}

describe('consumeTextStream', () => {
  it('publishes the first chunk before reading the second and keeps one complete response', async () => {
    const encoder = new TextEncoder()
    const secondChunkGate = createGate()
    const chunks = [encoder.encode('Первый фрагмент'), encoder.encode(' и финал')]
    const published: string[] = []
    let readCount = 0

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (readCount === 1) {
          await secondChunkGate.promise
        }

        if (readCount >= chunks.length) {
          controller.close()
          return
        }

        controller.enqueue(chunks[readCount])
        readCount += 1
      },
    })

    const consuming = consumeTextStream(
      stream,
      text => {
        published.push(text)
      },
      () => Promise.resolve(),
    )

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(published).toEqual(['Первый фрагмент'])

    secondChunkGate.open()
    await expect(consuming).resolves.toBe('Первый фрагмент и финал')
    expect(published).toEqual(['Первый фрагмент', 'Первый фрагмент и финал'])
  })

  it('preserves UTF-8 characters split between chunks and flushes the final decoder buffer', async () => {
    const encoder = new TextEncoder()
    const text = 'Привет 🙂'
    const bytes = encoder.encode(text)
    const splitAt = bytes.length - 2
    const published: string[] = []

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, splitAt))
        controller.enqueue(bytes.slice(splitAt))
        controller.close()
      },
    })

    await expect(consumeTextStream(
      stream,
      nextText => {
        published.push(nextText)
      },
      () => Promise.resolve(),
    )).resolves.toBe(text)

    expect(published.at(-1)).toBe(text)
    expect(published).not.toContain('Привет �')
  })
})

describe('consumeDailyChatSseStream', () => {
  it('publishes the first text event before reading the second chunk', async () => {
    const encoder = new TextEncoder()
    const secondChunkGate = createGate()
    const chunks = [
      encoder.encode('event: text\ndata: {"text":"Первый"}\n\n'),
      encoder.encode('event: text\ndata: {"text":" второй"}\n\n'),
    ]
    const published: string[] = []
    let readCount = 0
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (readCount === 1) await secondChunkGate.promise
        if (readCount >= chunks.length) {
          controller.close()
          return
        }
        controller.enqueue(chunks[readCount])
        readCount += 1
      },
    })

    const consuming = consumeDailyChatSseStream(stream, {
      onText: (_frame, fullText) => {
        published.push(fullText)
      },
    }, () => Promise.resolve())

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(published).toEqual(['Первый'])
    secondChunkGate.open()
    await expect(consuming).resolves.toMatchObject({ text: 'Первый второй' })
  })

  it('handles split events, multiple events per chunk and split UTF-8', async () => {
    const encoder = new TextEncoder()
    const text = 'Привет 🙂'
    const bytes = encoder.encode(`event: text\ndata: {"text":"${text}"}\n\nevent: proposal\ndata: {"metadata":{"type":"daily_schedule_proposal"}}\n\nevent: done\ndata: {"assistantMessageId":"msg-1"}\n\n`)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 7))
        controller.enqueue(bytes.slice(7, bytes.length - 3))
        controller.enqueue(bytes.slice(bytes.length - 3))
        controller.close()
      },
    })
    const frames: string[] = []
    let metadata: unknown = null
    const result = await consumeDailyChatSseStream(stream, {
      onText: frame => {
        frames.push(frame)
      },
      onProposal: next => { metadata = next },
    }, () => Promise.resolve())

    expect(frames).toEqual([text])
    expect(metadata).toEqual({ type: 'daily_schedule_proposal' })
    expect(result).toMatchObject({ text, assistantMessageId: 'msg-1' })
  })

  it('surfaces SSE error and rejects the consumer', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: error\ndata: {"error":"AI unavailable"}\n\n'))
        controller.close()
      },
    })
    let visibleError = ''

    await expect(consumeDailyChatSseStream(stream, {
      onError: error => {
        visibleError = error
      },
    }, () => Promise.resolve())).rejects.toBeInstanceOf(DailyChatSseError)
    expect(visibleError).toBe('AI unavailable')
  })

  it('parses schedule_applied event split across chunks with v2 schedule payload', async () => {
    const encoder = new TextEncoder()
    const payload = {
      schedule: {
        version: 2,
        timezone: 'Europe/Moscow',
        dayStartMinutes: 540,
        dayEndMinutes: 1080,
        blocks: [
          { id: 'task-1', kind: 'task', taskIndex: 1, taskText: 'Фокус', startMinutes: 540, durationMinutes: 90 },
          { id: 'meal-1', kind: 'meal', title: 'Обед', startMinutes: 720, durationMinutes: 45 },
        ],
      },
      updatedAt: '2026-07-16T09:00:00.000Z',
      status: 'applied',
      proposalMessageId: 'msg-proposal',
    }
    const bytes = encoder.encode(`event: schedule_applied\ndata: ${JSON.stringify(payload)}\n\nevent: done\ndata: {"assistantMessageId":"msg-assistant"}\n\n`)
    const applied: unknown[] = []
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 13))
        controller.enqueue(bytes.slice(13, bytes.length - 5))
        controller.enqueue(bytes.slice(bytes.length - 5))
        controller.close()
      },
    })

    const result = await consumeDailyChatSseStream(stream, {
      onScheduleApplied: event => {
        applied.push(event)
      },
    }, () => Promise.resolve())

    expect(applied).toHaveLength(1)
    expect(result.scheduleApplied).toMatchObject({
      schedule: payload.schedule,
      updatedAt: payload.updatedAt,
      status: payload.status,
      proposalMessageId: payload.proposalMessageId,
    })
    expect(result.assistantMessageId).toBe('msg-assistant')
  })

  it('normalizes numeric proposalMessageId in schedule_applied event', async () => {
    const encoder = new TextEncoder()
    const payload = {
      schedule: {
        version: 2,
        timezone: 'Europe/Moscow',
        dayStartMinutes: 540,
        dayEndMinutes: 1080,
        blocks: [],
      },
      updatedAt: '2026-07-16T09:00:00.000Z',
      status: 'applied',
      proposalMessageId: 12345,
    }
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`event: schedule_applied\ndata: ${JSON.stringify(payload)}\n\n`))
        controller.close()
      },
    })

    await expect(consumeDailyChatSseStream(stream, {}, () => Promise.resolve()))
      .resolves.toMatchObject({ scheduleApplied: { proposalMessageId: '12345' } })
  })

  it('ignores invalid schedule_applied payloads', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: schedule_applied\ndata: {"schedule":{"version":2,"blocks":[]},"updatedAt":"now","status":"applied"}\n\n'))
        controller.close()
      },
    })

    await expect(consumeDailyChatSseStream(stream, {}, () => Promise.resolve()))
      .resolves.toMatchObject({ scheduleApplied: null })
  })
})
