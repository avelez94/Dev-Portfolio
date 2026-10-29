'use client'
/**
 * Loads rows for one admin page through the authenticated data route
 * (src/lib/supabase-admin-browser.ts). Each page asks only for the tables it
 * shows, and gets a loading flag, an error message, and a reload function.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

type Result<T> = PromiseLike<{ data: T[] | null; error: { message?: string } | null }>

export function useRows<T>(query: () => Result<T>, deps: unknown[] = []) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const q = useRef(query)
  useEffect(() => { q.current = query }) // runs before the load effect below
  const seq = useRef(0)

  const load = useCallback(async () => {
    const n = ++seq.current
    const { data, error } = await q.current()
    if (n !== seq.current) return // a newer request replaced this one
    if (error) setError(error.message || 'Couldn’t load this data.')
    else { setError(null); setRows(data || []) }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(async () => { setLoading(true); await load() }, [load])
  return { rows, loading, error, reload, setRows }
}

/** Combines several useRows results into one page state. */
export function combine(...r: { loading: boolean; error: string | null; reload: () => Promise<void> }[]) {
  return {
    loading: r.some((x) => x.loading),
    error: r.find((x) => x.error)?.error || null,
    retry: () => Promise.all(r.map((x) => x.reload())),
  }
}
