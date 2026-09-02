import { createBrowserClient } from '@supabase/ssr'
import { requireSupabasePublicConfig } from '@/lib/supabase/config'

export function createClient() {
  const { url, key } = requireSupabasePublicConfig()
  return createBrowserClient(url, key)
}
