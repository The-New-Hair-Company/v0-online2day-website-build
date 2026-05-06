'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── EVENTS ───────────────────────────────────────────────────────────────────

export async function getEnterpriseEvents() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('enterprise_events')
    .select('*')
    .order('event_time', { ascending: true })
  return (data || []).map((e) => ({ id: e.id, title: e.title, time: e.event_time || '', type: e.event_type || 'meeting' }))
}

export async function addEnterpriseEvent(title: string, time: string, type = 'meeting') {
  const supabase = await createClient()
  const { error } = await supabase.from('enterprise_events').insert({ title, event_time: time, event_type: type })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/enterprise')
  return { success: true }
}

export async function deleteEnterpriseEvent(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('enterprise_events').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/enterprise')
  return { success: true }
}

// ─── TASKS ────────────────────────────────────────────────────────────────────

export async function getEnterpriseTasks() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('enterprise_tasks')
    .select('*')
    .order('created_at', { ascending: true })
  return (data || []).map((t) => ({ id: t.id, title: t.title, isDone: t.is_done || false }))
}

export async function addEnterpriseTask(title: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('enterprise_tasks').insert({ title })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/enterprise')
  return { success: true }
}

export async function toggleEnterpriseTask(id: string, isDone: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('enterprise_tasks')
    .update({ is_done: isDone, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/enterprise')
  return { success: true }
}

// ─── STATE ────────────────────────────────────────────────────────────────────

export async function getEnterpriseStateValue(key: string): Promise<unknown> {
  const supabase = await createClient()
  const { data } = await supabase.from('enterprise_state').select('value').eq('key', key).single()
  return data?.value ?? null
}

export async function setEnterpriseStateValue(key: string, value: unknown) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('enterprise_state')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return { error: error.message }
  return { success: true }
}

export async function getEnabledFeatures(): Promise<string[]> {
  const result = await getEnterpriseStateValue('enabled_features')
  return Array.isArray(result) ? result : []
}

export async function setEnabledFeatures(ids: string[]) {
  return setEnterpriseStateValue('enabled_features', ids)
}

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  const result = await getEnterpriseStateValue('feature_flags')
  if (!result || typeof result !== 'object') return {}
  return Object.entries(result as Record<string, unknown>).reduce<Record<string, boolean>>((acc, [key, value]) => {
    acc[key] = Boolean(value)
    return acc
  }, {})
}

export async function setFeatureFlags(flags: Record<string, boolean>) {
  return setEnterpriseStateValue('feature_flags', flags)
}

export async function getReplySentimentCounts(): Promise<Record<string, number>> {
  const result = await getEnterpriseStateValue('reply_sentiment_counts')
  if (!result || typeof result !== 'object') return {}
  return Object.entries(result as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, value]) => {
    const parsed = Number(value)
    acc[key] = Number.isFinite(parsed) ? parsed : 0
    return acc
  }, {})
}

export async function setReplySentimentCounts(counts: Record<string, number>) {
  return setEnterpriseStateValue('reply_sentiment_counts', counts)
}

export type EnterpriseSnippet = {
  id: string
  title: string
  content: string
  createdAt: string
}

export async function getSharedSnippets(): Promise<EnterpriseSnippet[]> {
  const result = await getEnterpriseStateValue('shared_snippets')
  if (!Array.isArray(result)) return []
  return result
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const id = typeof row.id === 'string' ? row.id : ''
      const title = typeof row.title === 'string' ? row.title : ''
      const content = typeof row.content === 'string' ? row.content : ''
      const createdAt = typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString()
      if (!id || !title || !content) return null
      return { id, title, content, createdAt }
    })
    .filter((item): item is EnterpriseSnippet => Boolean(item))
}

export async function setSharedSnippets(snippets: EnterpriseSnippet[]) {
  return setEnterpriseStateValue('shared_snippets', snippets)
}

export type PermissionMatrixValue = {
  role: string
  canManageUsers: boolean
  canManageBilling: boolean
  canManageLeads: boolean
  canManageCampaigns: boolean
  canViewAudit: boolean
}

export async function getPermissionMatrix(): Promise<PermissionMatrixValue[]> {
  const result = await getEnterpriseStateValue('permission_matrix')
  if (!Array.isArray(result)) return []
  return result
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      if (typeof row.role !== 'string') return null
      return {
        role: row.role,
        canManageUsers: Boolean(row.canManageUsers),
        canManageBilling: Boolean(row.canManageBilling),
        canManageLeads: Boolean(row.canManageLeads),
        canManageCampaigns: Boolean(row.canManageCampaigns),
        canViewAudit: Boolean(row.canViewAudit),
      }
    })
    .filter((item): item is PermissionMatrixValue => Boolean(item))
}

export async function setPermissionMatrix(matrix: PermissionMatrixValue[]) {
  return setEnterpriseStateValue('permission_matrix', matrix)
}

export async function getReleaseNotesDraft(): Promise<string> {
  const result = await getEnterpriseStateValue('release_notes_draft')
  return typeof result === 'string' ? result : ''
}

export async function setReleaseNotesDraft(notes: string) {
  return setEnterpriseStateValue('release_notes_draft', notes)
}

export type UserNotification = {
  id: string
  title: string
  detail: string
  source: string
  severity: 'info' | 'warning' | 'critical'
  createdAt: string
  readAt: string | null
}

function notificationKey(userId: string) {
  return `notifications:${userId}`
}

function normalizeNotification(item: Record<string, unknown>): UserNotification | null {
  if (typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.detail !== 'string') return null
  const severityRaw = typeof item.severity === 'string' ? item.severity : 'info'
  const severity: UserNotification['severity'] =
    severityRaw === 'warning' || severityRaw === 'critical' ? severityRaw : 'info'
  return {
    id: item.id,
    title: item.title,
    detail: item.detail,
    source: typeof item.source === 'string' ? item.source : 'system',
    severity,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : typeof item.created_at === 'string' ? item.created_at : new Date().toISOString(),
    readAt: typeof item.readAt === 'string' ? item.readAt : typeof item.read_at === 'string' ? item.read_at : null,
  }
}

async function getLegacyNotifications(userId: string): Promise<UserNotification[]> {
  const value = await getEnterpriseStateValue(notificationKey(userId))
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (item && typeof item === 'object' ? normalizeNotification(item as Record<string, unknown>) : null))
    .filter((item): item is UserNotification => Boolean(item))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getUserNotifications(): Promise<UserNotification[]> {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) return []

  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, detail, source, severity, created_at, read_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(80)

  if (!error && data) {
    return data
      .map((row) => normalizeNotification(row as unknown as Record<string, unknown>))
      .filter((item): item is UserNotification => Boolean(item))
  }

  return getLegacyNotifications(userId)
}

export async function addUserNotification(input: { title: string; detail: string; source?: string; severity?: UserNotification['severity'] }) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) return { error: 'Not authenticated' }

  const now = new Date().toISOString()
  const severity = input.severity === 'warning' || input.severity === 'critical' ? input.severity : 'info'
  const source = input.source?.trim() || 'system'
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title: input.title.trim(),
    detail: input.detail.trim(),
    source,
    severity,
    created_at: now,
    read_at: null,
  } as any)

  if (!error) return { success: true }

  const current = await getLegacyNotifications(userId)
  const next: UserNotification[] = [{
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: input.title.trim(),
    detail: input.detail.trim(),
    source,
    severity: severity as UserNotification['severity'],
    createdAt: now,
    readAt: null,
  }, ...current].slice(0, 80)
  return setEnterpriseStateValue(notificationKey(userId), next)
}

export async function markAllNotificationsRead() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) return { error: 'Not authenticated' }
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: now } as any)
    .eq('user_id', userId)
    .is('read_at', null)

  if (!error) return { success: true }

  const current = await getLegacyNotifications(userId)
  const next = current.map((item) => item.readAt ? item : { ...item, readAt: now })
  return setEnterpriseStateValue(notificationKey(userId), next)
}

export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) return { error: 'Not authenticated' }
  if (!notificationId) return { error: 'Notification is required' }
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: now } as any)
    .eq('id', notificationId)
    .eq('user_id', userId)

  if (!error) return { success: true }

  const current = await getLegacyNotifications(userId)
  const next = current.map((item) => item.id === notificationId ? { ...item, readAt: now } : item)
  return setEnterpriseStateValue(notificationKey(userId), next)
}

export type ReportSnapshot = {
  id: string
  periodLabel: string
  kpis: Record<string, number | string>
  createdAt: string
  createdBy: string | null
}

function reportSnapshotKey(userId: string) {
  return `report_snapshots:${userId}`
}

export async function getReportSnapshots(limit = 12): Promise<ReportSnapshot[]> {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) return []

  const { data, error } = await supabase
    .from('report_snapshots')
    .select('id, period_label, kpis, created_at, created_by')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!error && data) {
    return data.map((row: any) => ({
      id: String(row.id),
      periodLabel: String(row.period_label || 'Snapshot'),
      kpis: row.kpis && typeof row.kpis === 'object' ? row.kpis : {},
      createdAt: String(row.created_at || new Date().toISOString()),
      createdBy: row.created_by ? String(row.created_by) : null,
    }))
  }

  const legacy = await getEnterpriseStateValue(reportSnapshotKey(userId))
  if (!Array.isArray(legacy)) return []
  return legacy
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      if (typeof row.id !== 'string') return null
      return {
        id: row.id,
        periodLabel: typeof row.periodLabel === 'string' ? row.periodLabel : 'Snapshot',
        kpis: row.kpis && typeof row.kpis === 'object' ? row.kpis as Record<string, number | string> : {},
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
        createdBy: typeof row.createdBy === 'string' ? row.createdBy : null,
      }
    })
    .filter((item): item is ReportSnapshot => Boolean(item))
    .slice(0, limit)
}

export async function captureReportSnapshot(input: { periodLabel: string; kpis: Record<string, number | string> }) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) return { error: 'Not authenticated' }

  const row = {
    user_id: userId,
    period_label: input.periodLabel.trim() || 'Snapshot',
    kpis: input.kpis,
    created_by: userId,
    created_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('report_snapshots').insert(row as any)
  if (!error) return { success: true }

  const current = await getReportSnapshots(20)
  const next: ReportSnapshot[] = [{
    id: `snap-${Date.now()}`,
    periodLabel: row.period_label,
    kpis: row.kpis,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }, ...current].slice(0, 20)
  return setEnterpriseStateValue(reportSnapshotKey(userId), next)
}

// ─── LEADS EXPORT ─────────────────────────────────────────────────────────────

export async function getLeadsForExport() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leads')
    .select('name, email, phone, company, website, status, source, notes, follow_up_date, last_contacted_at, created_at')
    .order('created_at', { ascending: false })
  return (data || []) as Array<{
    name: string
    email: string | null
    phone: string | null
    company: string | null
    website: string | null
    status: string
    source: string | null
    notes: string | null
    follow_up_date: string | null
    last_contacted_at: string | null
    created_at: string
  }>
}

// ─── DATA QUALITY SCAN ────────────────────────────────────────────────────────

export async function scanDataQuality() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leads')
    .select('email, phone, company, source, assigned_to, follow_up_date')
  const leads = data || []
  return {
    total: leads.length,
    missingEmail: leads.filter((l) => !l.email).length,
    missingPhone: leads.filter((l) => !l.phone).length,
    missingCompany: leads.filter((l) => !l.company).length,
    missingSource: leads.filter((l) => !l.source).length,
    missingOwner: leads.filter((l) => !l.assigned_to).length,
    missingFollowUp: leads.filter((l) => !l.follow_up_date).length,
  }
}
