import { createClient } from '@supabase/supabase-js'

// Uses the service role key — bypasses RLS. Only call from server-side code.
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local to enable trial signups.')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
