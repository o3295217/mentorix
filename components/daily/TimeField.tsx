'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { minutesToTimeLabel, timeLabelToMinutes } from '@/hooks/daily/schedule-helpers'

// Custom HH:MM picker in the app's own style, replacing the native
// `<input type="time">` widget (Chrome's picker ignores app CSS entirely).
// Renders its dropdown through a portal so it isn't clipped by the
// `overflow-hidden` schedule block card it lives inside, and clamps its
// position to the viewport so it never runs off-screen on mobile.

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DROPDOWN_WIDTH = 128
const DROPDOWN_MAX_HEIGHT = 176
const VIEWPORT_MARGIN = 8

function getMinuteOptions(stepMinutes: number): number[] {
  const options: number[] = []
  for (let m = 0; m < 60; m += stepMinutes) options.push(m)
  return options
}

export type TimeFieldProps = {
  value: number // minutes since midnight
  onChange: (minutes: number) => void
  disabled?: boolean
  ariaLabel: string
  stepMinutes?: number
  className?: string
}

export default function TimeField({ value, onChange, disabled = false, ariaLabel, stepMinutes = 15, className = '' }: TimeFieldProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(() => minutesToTimeLabel(value))
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setText(minutesToTimeLabel(value))
  }, [value])

  const updatePosition = () => {
    const anchor = inputRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const showAbove = spaceBelow < DROPDOWN_MAX_HEIGHT + VIEWPORT_MARGIN && rect.top > spaceBelow
    const top = showAbove
      ? Math.max(VIEWPORT_MARGIN, rect.top - DROPDOWN_MAX_HEIGHT - 4)
      : Math.min(rect.bottom + 4, Math.max(VIEWPORT_MARGIN, window.innerHeight - DROPDOWN_MAX_HEIGHT - VIEWPORT_MARGIN))
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.right - DROPDOWN_WIDTH),
      Math.max(VIEWPORT_MARGIN, window.innerWidth - DROPDOWN_WIDTH - VIEWPORT_MARGIN),
    )
    setPosition({ top, left })
  }

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    const onScrollOrResize = () => updatePosition()
    // capture:true so scrolling inside any nested scrollable ancestor
    // (the timeline body, the card's own overflow-y-auto content) repositions us too.
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      dropdownRef.current?.querySelectorAll<HTMLElement>('[data-selected="true"]').forEach(el => {
        el.scrollIntoView({ block: 'center' })
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (inputRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [open])

  const commitText = (raw: string) => {
    const m = timeLabelToMinutes(raw)
    if (m >= 0) {
      onChange(m)
    } else {
      setText(minutesToTimeLabel(value))
    }
  }

  const hours = Math.floor(value / 60)
  const minutes = value % 60
  const minuteOptions = getMinuteOptions(stepMinutes)

  const pick = (h: number, m: number) => {
    const next = h * 60 + m
    onChange(next)
    setText(minutesToTimeLabel(next))
    inputRef.current?.focus()
  }

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        placeholder="ЧЧ:ММ"
        disabled={disabled}
        className={`w-16 rounded bg-gray-900 px-1.5 py-1 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-blue-400 ${className}`}
        value={text}
        onChange={e => setText(e.target.value)}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => commitText(text)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitText(text)
            setOpen(false)
          } else if (e.key === 'Escape' && open) {
            // Close the dropdown only — let the outer form stay open.
            e.preventDefault()
            e.stopPropagation()
            setText(minutesToTimeLabel(value))
            setOpen(false)
          }
        }}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
      />
      {open && !disabled && position && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label={`${ariaLabel}: выбор часов и минут`}
          className="fixed z-50 flex overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-xl"
          style={{ top: position.top, left: position.left, width: DROPDOWN_WIDTH, maxHeight: DROPDOWN_MAX_HEIGHT }}
          onPointerDown={e => e.stopPropagation()}
        >
          <div className="max-h-full flex-1 overflow-y-auto border-r border-gray-700 py-1">
            {HOURS.map(h => (
              <button
                key={h}
                type="button"
                data-selected={h === hours}
                className={`block w-full px-2 py-1 text-left text-xs ${h === hours ? 'bg-blue-600 font-semibold text-white' : 'text-gray-200 hover:bg-gray-800'}`}
                onClick={() => pick(h, minutes)}
              >
                {String(h).padStart(2, '0')}
              </button>
            ))}
          </div>
          <div className="max-h-full flex-1 overflow-y-auto py-1">
            {minuteOptions.map(m => (
              <button
                key={m}
                type="button"
                data-selected={m === minutes}
                className={`block w-full px-2 py-1 text-left text-xs ${m === minutes ? 'bg-blue-600 font-semibold text-white' : 'text-gray-200 hover:bg-gray-800'}`}
                onClick={() => pick(hours, m)}
              >
                {String(m).padStart(2, '0')}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
