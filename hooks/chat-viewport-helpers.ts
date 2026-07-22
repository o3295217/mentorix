export const GOALS_CHAT_DRAFT_KEY = 'mentorix:chat-draft:goals'

export const CHAT_NEAR_BOTTOM_THRESHOLD = 80
export const KEYBOARD_INSET_THRESHOLD = 80

export interface ScrollMetrics {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

export interface VisualViewportInput {
  layoutHeight: number
  viewportHeight?: number
  offsetTop?: number
}

export interface ChatViewportMetrics {
  height: number
  offsetTop: number
  keyboardInset: number
  keyboardVisible: boolean
}

export interface VisibilityInput {
  targetTop: number
  targetBottom: number
  viewportTop: number
  viewportHeight: number
  padding?: number
  bottomInset?: number
}

export interface BottomObstructionInput {
  viewportTop: number
  viewportHeight: number
  obstructionTop?: number
}

export function isChatNearBottom(
  metrics: ScrollMetrics,
  threshold = CHAT_NEAR_BOTTOM_THRESHOLD,
) {
  const remaining = metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop
  return remaining <= threshold
}

export function shouldKeepChatAtBottom(wasNearBottom: boolean, force = false) {
  return force || wasNearBottom
}

export function calculateChatViewportMetrics({
  layoutHeight,
  viewportHeight = layoutHeight,
  offsetTop = 0,
}: VisualViewportInput): ChatViewportMetrics {
  const safeLayoutHeight = Math.max(0, layoutHeight)
  const safeHeight = Math.max(0, Math.min(viewportHeight, safeLayoutHeight || viewportHeight))
  const safeOffsetTop = Math.max(0, offsetTop)
  const keyboardInset = Math.max(0, safeLayoutHeight - safeOffsetTop - safeHeight)

  return {
    height: safeHeight,
    offsetTop: safeOffsetTop,
    keyboardInset,
    keyboardVisible: keyboardInset >= KEYBOARD_INSET_THRESHOLD,
  }
}

export function getScrollAdjustmentForVisibility({
  targetTop,
  targetBottom,
  viewportTop,
  viewportHeight,
  padding = 12,
  bottomInset = 0,
}: VisibilityInput) {
  const visibleTop = viewportTop + padding
  const visibleBottom = viewportTop + viewportHeight - Math.max(0, bottomInset) - padding

  if (targetBottom > visibleBottom) return targetBottom - visibleBottom
  if (targetTop < visibleTop) return targetTop - visibleTop
  return 0
}

export function getBottomObstructionInset({
  viewportTop,
  viewportHeight,
  obstructionTop,
}: BottomObstructionInput) {
  if (obstructionTop === undefined) return 0
  const visibleBottom = viewportTop + Math.max(0, viewportHeight)
  return Math.min(
    Math.max(0, viewportHeight),
    Math.max(0, visibleBottom - Math.max(viewportTop, obstructionTop)),
  )
}

export function getDailyChatDraftKey(date: string) {
  return `mentorix:chat-draft:daily:${date}`
}
