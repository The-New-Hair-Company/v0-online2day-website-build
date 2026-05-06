'use server'

import { createClient } from '@/lib/supabase/server'
import { getEnterpriseStateValue, setEnterpriseStateValue } from '@/lib/actions/enterprise-actions'

type SecurityEventInput = {
  type: 'invalid_uuid' | 'failed_auth' | 'rate_limit' | 'csp_violation'
  route: string
  ip: string
  detail?: string
}

type SecurityCounterRow = {
  key: string
  count: number
  firstSeenAt: string
  lastSeenAt: string
}

function minuteBucket() {
  const now = new Date()
  now.setSeconds(0, 0)
  return now.toISOString()
}

export async function recordSecurityEvent(input: SecurityEventInput) {
  const supabase = await createClient()
  const nowIso = new Date().toISOString()
  const bucket = minuteBucket()
  const counterKey = `${input.type}:${input.route}:${input.ip}:${bucket}`

  const insertResult = await supabase.from('security_events').insert({
    event_type: input.type,
    route: input.route,
    ip: input.ip,
    detail: input.detail || null,
    created_at: nowIso,
  } as any)

  if (insertResult.error) {
    const legacyKey = 'security_events_fallback'
    const existing = await getEnterpriseStateValue(legacyKey)
    const list = Array.isArray(existing) ? existing : []
    const next = [{
      eventType: input.type,
      route: input.route,
      ip: input.ip,
      detail: input.detail || null,
      createdAt: nowIso,
    }, ...list].slice(0, 300)
    await setEnterpriseStateValue(legacyKey, next)
  }

  const counterStateKey = 'security_event_counters'
  const currentCounters = await getEnterpriseStateValue(counterStateKey)
  const rows: SecurityCounterRow[] = Array.isArray(currentCounters) ? currentCounters as SecurityCounterRow[] : []
  const existing = rows.find((row) => row.key === counterKey)
  if (existing) {
    existing.count += 1
    existing.lastSeenAt = nowIso
  } else {
    rows.push({ key: counterKey, count: 1, firstSeenAt: nowIso, lastSeenAt: nowIso })
  }
  const trimmed = rows
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, 400)
  await setEnterpriseStateValue(counterStateKey, trimmed)

  const count = trimmed.find((row) => row.key === counterKey)?.count || 1
  if (count === 5 || count === 10 || count === 20) {
    await supabase.from('admin_audit_log').insert({
      action: 'security_alert',
      resource: 'security_event',
      resource_id: input.route,
      changes: JSON.stringify({
        type: input.type,
        ip: input.ip,
        bucket,
        count,
        detail: input.detail || null,
      }),
      created_at: nowIso,
    } as any)
  }
}

export async function getSecurityEvents(limit = 60) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('security_events')
    .select('event_type, route, ip, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!error && data) {
    return data.map((row: any) => ({
      type: String(row.event_type || 'unknown'),
      route: String(row.route || 'unknown'),
      ip: String(row.ip || 'unknown'),
      detail: row.detail ? String(row.detail) : '',
      createdAt: String(row.created_at || new Date().toISOString()),
    }))
  }

  const fallback = await getEnterpriseStateValue('security_events_fallback')
  if (!Array.isArray(fallback)) return []
  return fallback.slice(0, limit).map((row: any) => ({
    type: String(row?.eventType || 'unknown'),
    route: String(row?.route || 'unknown'),
    ip: String(row?.ip || 'unknown'),
    detail: row?.detail ? String(row.detail) : '',
    createdAt: String(row?.createdAt || new Date().toISOString()),
  }))
}

export async function clearSecurityEvents() {
  const supabase = await createClient()
  await supabase.from('security_events').delete().neq('created_at', '')
  await setEnterpriseStateValue('security_events_fallback', [])
  await setEnterpriseStateValue('security_event_counters', [])
  return { success: true }
}
