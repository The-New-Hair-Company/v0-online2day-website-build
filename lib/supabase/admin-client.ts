import { createClient } from '@supabase/supabase-js'
import { supabaseUrl } from '@/lib/supabase/config'

// Uses a privileged server key — bypasses RLS. Only call from server-side code.
// Supabase's Vercel integration supplies SUPABASE_SECRET_KEY; legacy/manual
// environments may still supply SUPABASE_SERVICE_ROLE_KEY.
export function createAdminClient() {
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.O2D_DB_SUPABASE_SECRET_KEY ||
    process.env.O2D_DB_SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !key) {
    throw new Error('A Supabase server key is not configured.')
  }
  return createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
