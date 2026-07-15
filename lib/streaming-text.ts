export type TextDeltaEvent = {
  type: string
  delta?: {
    type?: string
    text?: string
  }
}

export async function streamTextDeltas(
  events: AsyncIterable<unknown>,
  onDelta: (text: string) => void
): Promise<string> {
  let fullText = ''

  for await (const rawEvent of events) {
    const event = rawEvent as TextDeltaEvent
    if (event.type !== 'content_block_delta' || event.delta?.type !== 'text_delta') {
      continue
    }

    const text = event.delta.text
    if (!text) {
      continue
    }

    fullText += text
    onDelta(text)
  }

  return fullText
}
