export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_O2D_DB_SUPABASE_URL

export const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_O2D_DB_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_O2D_DB_SUPABASE_ANON_KEY

export function requireSupabasePublicConfig() {
  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error('Supabase public configuration is not available.')
  }
  return { url: supabaseUrl, key: supabasePublicKey }
}
