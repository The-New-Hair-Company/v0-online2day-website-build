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
