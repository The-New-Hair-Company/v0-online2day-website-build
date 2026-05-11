'use server'

import { enterpriseApi, reportsApi, leadsApi } from '@/lib/api/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getToken(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────

export async function getEnterpriseEvents() {
  try {
    const token = await getToken()
    const events = await enterpriseApi.getEvents(token)
    return events.map((e) => ({ id: e.id, title: e.title, time: e.eventTime, type: e.eventType }))
  } catch {
    return []
  }
}

export async function addEnterpriseEvent(title: string, time: string, type = 'meeting') {
  try {
    const token = await getToken()
    await enterpriseApi.addEvent(token, { title, eventTime: time, eventType: type })
    revalidatePath('/dashboard/enterprise')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteEnterpriseEvent(id: string) {
  try {
    const token = await getToken()
    await enterpriseApi.deleteEvent(token, id)
    revalidatePath('/dashboard/enterprise')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── TASKS ────────────────────────────────────────────────────────────────────

export async function getEnterpriseTasks() {
  try {
    const token = await getToken()
    const tasks = await enterpriseApi.getTasks(token)
    return tasks.map((t) => ({ id: t.id, title: t.title, isDone: t.isDone }))
  } catch {
    return []
  }
}

export async function addEnterpriseTask(title: string) {
  try {
    const token = await getToken()
    await enterpriseApi.addTask(token, title)
    revalidatePath('/dashboard/enterprise')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function toggleEnterpriseTask(id: string, isDone: boolean) {
  try {
    const token = await getToken()
    await enterpriseApi.toggleTask(token, id, isDone)
    revalidatePath('/dashboard/enterprise')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── STATE (JSON key-value store) ─────────────────────────────────────────────

export async function getEnterpriseStateValue(key: string): Promise<unknown> {
  try {
    const token = await getToken()
    const result = await enterpriseApi.getState(token, key)
    if (!result) return null
    try { return JSON.parse(result.value) } catch { return result.value }
  } catch {
    return null
  }
}

export async function setEnterpriseStateValue(key: string, value: unknown) {
  try {
    const token = await getToken()
    await enterpriseApi.setState(token, key, JSON.stringify(value))
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getEnabledFeatures(): Promise<string[]> {
  const result = await getEnterpriseStateValue('enabled_features')
  return Array.isArray(result) ? result : []
}
export async function setEnabledFeatures(ids: string[]) { return setEnterpriseStateValue('enabled_features', ids) }

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  const result = await getEnterpriseStateValue('feature_flags')
  if (!result || typeof result !== 'object') return {}
  return Object.entries(result as Record<string, unknown>).reduce<Record<string, boolean>>((acc, [k, v]) => { acc[k] = Boolean(v); return acc }, {})
}
export async function setFeatureFlags(flags: Record<string, boolean>) { return setEnterpriseStateValue('feature_flags', flags) }

export async function getReplySentimentCounts(): Promise<Record<string, number>> {
  const result = await getEnterpriseStateValue('reply_sentiment_counts')
  if (!result || typeof result !== 'object') return {}
  return Object.entries(result as Record<string, unknown>).reduce<Record<string, number>>((acc, [k, v]) => { const n = Number(v); acc[k] = Number.isFinite(n) ? n : 0; return acc }, {})
}
export async function setReplySentimentCounts(counts: Record<string, number>) { return setEnterpriseStateValue('reply_sentiment_counts', counts) }

export type EnterpriseSnippet = { id: string; title: string; content: string; createdAt: string }
export async function getSharedSnippets(): Promise<EnterpriseSnippet[]> {
  const result = await getEnterpriseStateValue('shared_snippets')
  if (!Array.isArray(result)) return []
  return result.filter((item): item is EnterpriseSnippet =>
    Boolean(item && typeof item === 'object' && (item as any).id && (item as any).title && (item as any).content))
}
export async function setSharedSnippets(snippets: EnterpriseSnippet[]) { return setEnterpriseStateValue('shared_snippets', snippets) }

export type PermissionMatrixValue = { role: string; canManageUsers: boolean; canManageBilling: boolean; canManageLeads: boolean; canManageCampaigns: boolean; canViewAudit: boolean }
export async function getPermissionMatrix(): Promise<PermissionMatrixValue[]> {
  const result = await getEnterpriseStateValue('permission_matrix')
  if (!Array.isArray(result)) return []
  return result.filter((item): item is PermissionMatrixValue => Boolean(item && typeof item === 'object' && typeof (item as any).role === 'string'))
}
export async function setPermissionMatrix(matrix: PermissionMatrixValue[]) { return setEnterpriseStateValue('permission_matrix', matrix) }

export async function getReleaseNotesDraft(): Promise<string> {
  const result = await getEnterpriseStateValue('release_notes_draft')
  return typeof result === 'string' ? result : ''
}
export async function setReleaseNotesDraft(notes: string) { return setEnterpriseStateValue('release_notes_draft', notes) }

// ─── NOTIFICATIONS (direct Supabase — user-scoped realtime data) ──────────────

export type UserNotification = {
  id: string
  user_id: string
  title: string
  detail: string | null
  source: string | null
  severity: string | null
  read_at: string | null
  created_at: string
  // aliases the component expects
  readAt: string | null
  createdAt: string
}

export async function getUserNotifications(): Promise<UserNotification[]> {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []
  const { data } = await supabase
    .from('notifications').select('*').eq('user_id', auth.user.id)
    .order('created_at', { ascending: false }).limit(50)
  return (data || []).map((n: any) => ({ ...n, readAt: n.read_at ?? null, createdAt: n.created_at ?? new Date().toISOString() })) as UserNotification[]
}

export async function addUserNotification(input: { userId?: string; title: string; detail?: string; source?: string; severity?: string }) {
  const supabase = await createClient()
  let userId = input.userId
  if (!userId) {
    const { data: auth } = await supabase.auth.getUser()
    userId = auth.user?.id
  }
  if (!userId) return { error: 'No user ID' }
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title: input.title,
    detail: input.detail || null,
    source: input.source || 'system',
    severity: input.severity || 'info',
  })
  if (error) return { error: error.message }
  return { success: true }
}

export async function markAllNotificationsRead() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { error: 'Not authenticated' }
  const { error } = await supabase
    .from('notifications').update({ read_at: new Date().toISOString() })
    .eq('user_id', auth.user.id).is('read_at', null)
  if (error) return { error: error.message }
  return { success: true }
}

export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId)
  if (error) return { error: error.message }
  return { success: true }
}

// ─── REPORT SNAPSHOTS ─────────────────────────────────────────────────────────

export type ReportSnapshot = { id: string; periodLabel: string; kpis: Record<string, number | string>; createdAt: string; createdBy: string | null }

export async function getReportSnapshots(limit = 20): Promise<ReportSnapshot[]> {
  try {
    const token = await getToken()
    const snapshots = await reportsApi.list(token, limit)
    return snapshots.map((s) => ({
      id: s.id,
      periodLabel: s.type,
      kpis: (() => { try { return JSON.parse(s.data) } catch { return {} } })(),
      createdAt: s.createdAt,
      createdBy: s.capturedBy ?? null,
    }))
  } catch {
    return []
  }
}

export async function captureReportSnapshot(input: { periodLabel: string; kpis: Record<string, number | string> }) {
  try {
    const token = await getToken()
    await reportsApi.capture(token, { type: input.periodLabel.trim() || 'Snapshot', data: JSON.stringify(input.kpis) })
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ─── LEADS EXPORT ─────────────────────────────────────────────────────────────

export async function getLeadsForExport() {
  try {
    const token = await getToken()
    const leads = await leadsApi.list(token)
    return leads.map((l) => ({
      name: l.name, email: l.email ?? null, phone: l.phone ?? null,
      company: l.company ?? null, website: l.website ?? null, status: l.status,
      source: l.source ?? null, notes: l.notes ?? null,
      follow_up_date: l.followUpDate ?? null, last_contacted_at: l.lastContactedAt ?? null,
      created_at: l.createdAt,
    }))
  } catch { return [] }
}

// ─── DATA QUALITY SCAN ────────────────────────────────────────────────────────

export async function scanDataQuality() {
  try {
    const token = await getToken()
    const leads = await leadsApi.list(token)
    return {
      total: leads.length,
      missingEmail: leads.filter((l) => !l.email).length,
      missingPhone: leads.filter((l) => !l.phone).length,
      missingCompany: leads.filter((l) => !l.company).length,
      missingSource: leads.filter((l) => !l.source).length,
      missingOwner: leads.filter((l) => !l.assignedTo).length,
      missingFollowUp: leads.filter((l) => !l.followUpDate).length,
    }
  } catch {
    return { total: 0, missingEmail: 0, missingPhone: 0, missingCompany: 0, missingSource: 0, missingOwner: 0, missingFollowUp: 0 }
  }
}
