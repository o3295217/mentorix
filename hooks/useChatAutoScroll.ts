'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import {
  calculateChatViewportMetrics,
  getBottomObstructionInset,
  getScrollAdjustmentForVisibility,
  isChatNearBottom,
  type ChatViewportMetrics,
} from './chat-viewport-helpers'

interface UseChatAutoScrollOptions {
  containerRef: RefObject<HTMLElement | null>
  contentDependency: unknown
  active?: boolean
  scrollToBottomOnFirstActivate?: boolean
  focusTargetRef?: RefObject<HTMLElement | null>
  bottomObstructionSelector?: string
}

function readViewportMetrics(): ChatViewportMetrics | null {
  if (typeof window === 'undefined') return null
  const viewport = window.visualViewport
  return calculateChatViewportMetrics({
    layoutHeight: window.innerHeight,
    viewportHeight: viewport?.height,
    offsetTop: viewport?.offsetTop,
  })
}

export function useChatAutoScroll({
  containerRef,
  contentDependency,
  active = true,
  scrollToBottomOnFirstActivate = false,
  focusTargetRef,
  bottomObstructionSelector,
}: UseChatAutoScrollOptions) {
  const [viewportMetrics, setViewportMetrics] = useState<ChatViewportMetrics | null>(null)
  const isNearBottomRef = useRef(true)
  const wasActiveRef = useRef(false)
  const hasActivatedRef = useRef(false)
  const frameRef = useRef<number | null>(null)

  const cancelScheduledFrame = useCallback(() => {
    if (frameRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  const setContainerToBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
    isNearBottomRef.current = true
  }, [containerRef])

  const scheduleBottom = useCallback(() => {
    if (typeof window === 'undefined') return
    cancelScheduledFrame()
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      setContainerToBottom()
    })
  }, [cancelScheduledFrame, setContainerToBottom])

  const scrollToBottom = useCallback(() => {
    isNearBottomRef.current = true
    setContainerToBottom()
    scheduleBottom()
  }, [scheduleBottom, setContainerToBottom])

  const ensureFocusTargetVisible = useCallback(() => {
    if (typeof window === 'undefined') return
    const target = focusTargetRef?.current
    if (!target) return
    const metrics = readViewportMetrics()
    if (!metrics) return
    const rect = target.getBoundingClientRect()
    const obstruction = bottomObstructionSelector
      ? document.querySelector<HTMLElement>(bottomObstructionSelector)
      : null
    const obstructionRect = obstruction?.getBoundingClientRect()
    const bottomInset = obstructionRect && obstructionRect.height > 0
      ? getBottomObstructionInset({
          viewportTop: metrics.offsetTop,
          viewportHeight: metrics.height,
          obstructionTop: obstructionRect.top,
        })
      : 0
    const adjustment = getScrollAdjustmentForVisibility({
      targetTop: rect.top,
      targetBottom: rect.bottom,
      viewportTop: metrics.offsetTop,
      viewportHeight: metrics.height,
      padding: 12,
      bottomInset,
    })
    if (adjustment !== 0) window.scrollBy({ top: adjustment, behavior: 'auto' })
  }, [bottomObstructionSelector, focusTargetRef])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      isNearBottomRef.current = isChatNearBottom(container)
    }

    handleScroll()
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [containerRef, active])

  useLayoutEffect(() => {
    if (!active || !isNearBottomRef.current) return
    setContainerToBottom()
  }, [active, contentDependency, setContainerToBottom])

  useEffect(() => {
    const becameActive = active && !wasActiveRef.current
    wasActiveRef.current = active
    if (becameActive && scrollToBottomOnFirstActivate && !hasActivatedRef.current) {
      scrollToBottom()
    }
    if (active) hasActivatedRef.current = true
  }, [active, scrollToBottom, scrollToBottomOnFirstActivate])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const visualViewport = window.visualViewport

    const updateViewport = () => {
      const shouldRestoreBottom = isNearBottomRef.current
      const nextMetrics = readViewportMetrics()
      if (nextMetrics) setViewportMetrics(nextMetrics)

      cancelScheduledFrame()
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null
        if (shouldRestoreBottom) setContainerToBottom()
        const focusTarget = focusTargetRef?.current
        if (focusTarget && focusTarget.contains(document.activeElement)) {
          ensureFocusTargetVisible()
        }
      })
    }

    updateViewport()
    window.addEventListener('resize', updateViewport, { passive: true })
    visualViewport?.addEventListener('resize', updateViewport, { passive: true })
    visualViewport?.addEventListener('scroll', updateViewport, { passive: true })

    return () => {
      window.removeEventListener('resize', updateViewport)
      visualViewport?.removeEventListener('resize', updateViewport)
      visualViewport?.removeEventListener('scroll', updateViewport)
      cancelScheduledFrame()
    }
  }, [cancelScheduledFrame, ensureFocusTargetVisible, focusTargetRef, setContainerToBottom])

  return {
    viewportMetrics,
    scrollToBottom,
    ensureFocusTargetVisible,
  }
}
