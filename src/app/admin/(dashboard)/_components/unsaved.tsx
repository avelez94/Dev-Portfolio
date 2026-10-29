'use client'
/**
 * Warns before leaving a page with unsaved form input. A form calls
 * useUnsaved(dirty); the sidebar links ask before navigating away and the
 * browser asks before a refresh or close. Form drafts that already save
 * themselves (the proposal form) don't register.
 */
import { useEffect, useId } from 'react'

const dirty = new Set<string>()
export const hasUnsaved = () => dirty.size > 0
export const LEAVE_MESSAGE = 'You have unsaved changes on this page. Leave without saving them?'

export function confirmLeave() {
  return !hasUnsaved() || window.confirm(LEAVE_MESSAGE)
}

export function useUnsaved(isDirty: boolean) {
  const id = useId()
  useEffect(() => {
    if (isDirty) dirty.add(id)
    else dirty.delete(id)
    return () => { dirty.delete(id) }
  }, [id, isDirty])
}

/** Installed once by the shell: the browser's own prompt on refresh or close. */
export function useBeforeUnloadGuard() {
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (!hasUnsaved()) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBefore)
    return () => window.removeEventListener('beforeunload', onBefore)
  }, [])
}
