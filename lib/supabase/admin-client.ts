import { createClient } from '@supabase/supabase-js'

// Uses a privileged server key — bypasses RLS. Only call from server-side code.
// Supabase's Vercel integration supplies SUPABASE_SECRET_KEY; legacy/manual
// environments may still supply SUPABASE_SERVICE_ROLE_KEY.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('A Supabase server key is not configured.')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
