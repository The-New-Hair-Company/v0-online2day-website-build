'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function logAuditEntry(
  action: string,
  resource: string,
  resourceId?: string,
  changes?: string,
) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user

  await supabase.from('admin_audit_log').insert({
    user_id: user?.id ?? null,
    actor_email: user?.email ?? null,
    action,
    resource,
    resource_id: resourceId ?? null,
    changes: changes ?? null,
  })
}

export async function getAuditLog(limit = 100) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}
