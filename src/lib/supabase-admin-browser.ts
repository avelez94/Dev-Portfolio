'use client'

import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client for the admin dashboard. Every request goes through
 * /api/admin/data, which requires the admin cookie and adds the server key.
 * No database key is shipped to the browser for these tables.
 */
const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin

export const supabase = createClient(`${origin}/api/admin/data`, 'admin-session', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
