import type { ReactNode } from 'react'
import { FALLBACK_INVALID_PROPOSAL_MESSAGE } from '@/lib/daily-chat-constants'

export { FALLBACK_INVALID_PROPOSAL_MESSAGE }

export function isInvalidProposalFallbackMessage(content: string): boolean {
  return content.trim() === FALLBACK_INVALID_PROPOSAL_MESSAGE
}

function renderInlineStrong(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const regex = /\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    nodes.push(<strong key={`${keyPrefix}-${match.index}`} className="font-semibold text-gray-100">{match[1]}</strong>)
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export function renderAssistantMessageContent(content: string): ReactNode[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const nodes: ReactNode[] = []
  let listItems: ReactNode[][] = []

  const flushList = () => {
    if (listItems.length === 0) return
    const key = `list-${nodes.length}`
    nodes.push(
      <ul key={key} className="type-body my-2 space-y-1 pl-5 leading-6">
        {listItems.map((item, index) => <li key={index} className="list-disc">{item}</li>)}
      </ul>,
    )
    listItems = []
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) {
      flushList()
      return
    }
    const listMatch = trimmed.match(/^(?:\d+\.\s+|-\s+|•\s+)(.+)$/)
    if (listMatch) {
      listItems.push(renderInlineStrong(listMatch[1], `li-${index}`))
      return
    }
    flushList()
    nodes.push(<p key={`p-${index}`} className="type-body whitespace-pre-wrap leading-6">{renderInlineStrong(trimmed, `p-${index}`)}</p>)
  })
  flushList()
  return nodes
}
