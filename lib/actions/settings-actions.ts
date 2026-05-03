'use server'

import { createClient } from '@/lib/supabase/server'

export async function getAdminPref(key: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return null

  const { data } = await supabase
    .from('admin_preferences')
    .select('value')
    .eq('user_id', userData.user.id)
    .eq('key', key)
    .single()
  return data?.value ?? null
}

export async function getAdminPrefs(keys: string[]): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return {}

  const { data } = await supabase
    .from('admin_preferences')
    .select('key, value')
    .eq('user_id', userData.user.id)
    .in('key', keys)

  const result: Record<string, string> = {}
  for (const row of data || []) {
    result[row.key] = row.value
  }
  return result
}

export async function setAdminPref(key: string, value: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('admin_preferences')
    .upsert(
      { user_id: userData.user.id, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' },
    )
  if (error) return { error: error.message }
  return { success: true }
}

export async function setAdminPrefs(prefs: Record<string, string>) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }

  const rows = Object.entries(prefs).map(([key, value]) => ({
    user_id: userData.user!.id,
    key,
    value,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('admin_preferences')
    .upsert(rows, { onConflict: 'user_id,key' })
  if (error) return { error: error.message }
  return { success: true }
}
