import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

// fetch is looked up on each request (not captured when this module loads), so
// the preview demo's request scope applies to these calls too (src/lib/demo/intercept.ts).
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { global: { fetch: (input, init) => fetch(input, init) } }
)
