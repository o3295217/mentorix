import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FALLBACK_INVALID_PROPOSAL_MESSAGE, isInvalidProposalFallbackMessage, renderAssistantMessageContent } from '@/components/daily/chat-render-helpers'

describe('chat render helpers', () => {
  it('renders strong text and lightweight lists', () => {
    const html = renderToStaticMarkup(<>{renderAssistantMessageContent('**Важно**\n1. Первый\n- Второй\n• Третий')}</>)

    expect(html).toContain('<strong')
    expect(html).toContain('Важно')
    expect(html).toContain('<ul')
    expect(html).toContain('<li')
    expect(html).toContain('Первый')
  })

  it('keeps html injections as escaped text', () => {
    const html = renderToStaticMarkup(<>{renderAssistantMessageContent('<img src=x onerror=alert(1)> **ok**')}</>)

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toContain('<img')
  })

  it('detects invalid proposal fallback exactly', () => {
    expect(isInvalidProposalFallbackMessage(FALLBACK_INVALID_PROPOSAL_MESSAGE)).toBe(true)
    expect(isInvalidProposalFallbackMessage(`${FALLBACK_INVALID_PROPOSAL_MESSAGE} Ещё текст.`)).toBe(false)
  })
})
