'use client'

import { useRef, useCallback, useState } from 'react'

interface ExpandableInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  type?: string
}

export default function ExpandableInput({
  value,
  onChange,
  placeholder,
  className = 'input',
  type,
}: ExpandableInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)

  const autoResize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])

  const collapse = useCallback(() => {
    const el = ref.current
    if (!el) return
    // Сбрасываем высоту до одной строки
    el.style.height = ''
  }, [])

  const handleFocus = () => {
    setFocused(true)
    // Даём DOM обновиться, потом разворачиваем
    requestAnimationFrame(autoResize)
  }

  const handleBlur = () => {
    setFocused(false)
    collapse()
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Для полей type="number" фильтруем ввод
    if (type === 'number') {
      const val = e.target.value.replace(/[^0-9]/g, '')
      onChange(val)
    } else {
      onChange(e.target.value)
    }
    if (focused) {
      requestAnimationFrame(autoResize)
    }
  }

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      rows={1}
      className={`${className} expandable-input ${focused ? 'expandable-input--focused' : ''}`}
      inputMode={type === 'number' ? 'numeric' : undefined}
    />
  )
}
