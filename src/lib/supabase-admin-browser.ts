'use client'

import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client for the admin dashboard. Every request goes through
 * /api/admin/data, which requires the admin cookie and adds the server key.
 * No database key is shipped to the browser for these tables.
 */
const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin

/** Tells the dashboard when the admin session has ended, so it can ask to sign in again. */
const sessionAwareFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init)
  if (res.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('admin-session-expired'))
  return res
}

export const supabase = createClient(`${origin}/api/admin/data`, 'admin-session', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: sessionAwareFetch },
})
