'use server'

import { createClient } from '@/lib/supabase/server'
import { getEnterpriseStateValue, setEnterpriseStateValue } from '@/lib/actions/enterprise-actions'

type SecurityEventInput = {
  type: 'invalid_uuid' | 'failed_auth' | 'rate_limit'
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
