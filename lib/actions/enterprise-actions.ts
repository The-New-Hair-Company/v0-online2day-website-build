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
