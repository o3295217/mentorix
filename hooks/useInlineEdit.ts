import { useState, useCallback } from 'react'

export function useInlineEdit(onEditGoal: (index: number, text: string) => void) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')

  const startEdit = useCallback((index: number, text: string) => {
    setEditingIndex(index)
    setEditingText(text)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingIndex(null)
    setEditingText('')
  }, [])

  const saveEdit = useCallback((index: number) => {
    if (editingText.trim()) {
      onEditGoal(index, editingText)
    }
    setEditingIndex(null)
    setEditingText('')
  }, [editingText, onEditGoal])

  return { editingIndex, editingText, setEditingText, startEdit, cancelEdit, saveEdit }
}
