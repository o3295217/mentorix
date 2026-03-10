import { useState, useRef, useEffect, useCallback } from 'react'

export function useCopyDropdown() {
  const [copyDropdownIndex, setCopyDropdownIndex] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setCopyDropdownIndex(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleDropdown = useCallback((index: number) => {
    setCopyDropdownIndex(prev => prev === index ? null : index)
  }, [])

  const closeDropdown = useCallback(() => {
    setCopyDropdownIndex(null)
  }, [])

  return { copyDropdownIndex, dropdownRef, toggleDropdown, closeDropdown }
}
