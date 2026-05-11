'use server'

import { auditApi } from '@/lib/api/client'
import { createClient } from '@/lib/supabase/server'

async function getToken(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function logAuditEntry(
  action: string,
  resource: string,
  resourceId?: string,
  changes?: string,
) {
  const token = await getToken()
  if (!token) return

  await auditApi.log(token, {
    action,
    resource,
    resourceId: resourceId ?? null,
    changes: changes ?? null,
  }).catch((e) => console.error('Audit log error:', e))
}

export async function getAuditLog(limit = 100) {
  const token = await getToken()
  if (!token) return []

  try {
    return await auditApi.list(token, limit)
  } catch {
    return []
  }
}
