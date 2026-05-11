'use server'

import { createClient } from '@/lib/supabase/server'
import { leadsApi } from '@/lib/api/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function getToken(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

export async function createLead(formData: FormData) {
  const name = formData.get('name') as string
  if (!name) return { error: 'Name is required' }

  try {
    const token = await getToken()
    const lead = await leadsApi.create(token, {
      name,
      company: (formData.get('company') as string) || null,
      email: (formData.get('email') as string) || null,
      phone: (formData.get('phone') as string) || null,
      source: (formData.get('source') as string) || null,
      notes: (formData.get('notes') as string) || null,
      website: (formData.get('website') as string) || null,
    })
    revalidatePath('/dashboard/leads')
    return { data: lead }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateLead(leadId: string, formData: FormData) {
  const name = formData.get('name') as string
  if (!name) return { error: 'Name is required' }

  try {
    const token = await getToken()
    await leadsApi.update(token, leadId, {
      name,
      company: (formData.get('company') as string) || null,
      email: (formData.get('email') as string) || null,
      phone: (formData.get('phone') as string) || null,
      source: (formData.get('source') as string) || null,
      notes: (formData.get('notes') as string) || null,
      website: (formData.get('website') as string) || null,
      followUpDate: (formData.get('follow_up_date') as string) || null,
    })
    revalidatePath('/dashboard/leads')
    revalidatePath(`/dashboard/leads/${leadId}`)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteLead(leadId: string) {
  try {
    const token = await getToken()
    await leadsApi.delete(token, leadId)
  } catch (e) {
    return { error: (e as Error).message }
  }
  revalidatePath('/dashboard/leads')
  redirect('/dashboard/leads')
}

export async function updateLeadStatus(leadId: string, status: string) {
  try {
    const token = await getToken()
    await leadsApi.updateStatus(token, leadId, status)
    revalidatePath('/dashboard/leads')
    revalidatePath(`/dashboard/leads/${leadId}`)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function createLeadFromObject(data: {
  name: string
  company?: string
  role?: string
  email?: string
  phone?: string
  linkedin?: string
  source?: string
  stage?: string
  value?: string
  notes?: string
}) {
  if (!data.name?.trim()) return { error: 'Name is required.' }

  const numericValue = data.value
    ? Number(data.value.replace(/[^0-9.]/g, '')) || null
    : null

  try {
    const token = await getToken()
    const lead = await leadsApi.create(token, {
      name: data.name.trim(),
      company: data.company?.trim() || null,
      role: data.role?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      linkedInUrl: data.linkedin?.trim() || null,
      source: data.source || 'Website',
      status: data.stage || 'New',
      value: numericValue,
      notes: data.notes?.trim() || null,
    })

    // Log to activity feed directly (no .NET endpoint yet)
    const supabase = await createClient()
    const { data: user } = await supabase.auth.getUser()
    await supabase.from('activity_feed').insert({
      actor_name: user.user?.email || 'Admin',
      type: 'lead_created',
      entity_type: 'lead',
      entity_id: lead.id,
      entity_name: data.name,
      description: `New lead added: ${data.name}${data.company ? ` (${data.company})` : ''}`,
    })

    revalidatePath('/dashboard/leads')
    revalidatePath('/dashboard/overview')
    return { success: true, lead }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function logActivityEvent(data: {
  leadId?: string | null
  type: string
  notes?: string
  durationMinutes?: number
  billable?: boolean
}) {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  if (data.leadId) {
    const { error: evtError } = await supabase.from('lead_events').insert({
      lead_id: data.leadId,
      type: data.type.charAt(0).toUpperCase() + data.type.slice(1),
      note: data.notes?.trim() || `${data.type} activity logged`,
      created_by: user.user?.id || null,
      metadata: {
        durationMinutes: data.durationMinutes,
        billable: data.billable,
      },
    })
    if (evtError) return { error: evtError.message }
  }

  const { error: feedError } = await supabase.from('activity_feed').insert({
    actor_name: user.user?.email || 'Admin',
    type: `activity_${data.type}`,
    entity_type: data.leadId ? 'lead' : null,
    entity_id: data.leadId || null,
    description: data.notes?.trim() || `${data.type} activity logged${data.durationMinutes ? ` (${data.durationMinutes} min)` : ''}`,
  })
  if (feedError) return { error: feedError.message }

  if (data.leadId) revalidatePath(`/dashboard/leads/${data.leadId}`)
  revalidatePath('/dashboard/overview')
  revalidatePath('/dashboard/leads')
  return { success: true }
}

export async function logLeadEvent(leadId: string, type: string, note?: string, metadata?: Record<string, unknown>) {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  const { error } = await supabase.from('lead_events').insert({
    lead_id: leadId,
    type,
    note: note || '',
    metadata: metadata || null,
    created_by: user.user?.id || null,
  })

  if (error) console.error('Error logging event:', error)
}

export async function addLeadNote(leadId: string, note: string) {
  try {
    const token = await getToken()
    await leadsApi.addNote(token, leadId, note)
    revalidatePath(`/dashboard/leads/${leadId}`)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateLeadFields(leadId: string, fields: {
  name?: string
  email?: string
  phone?: string
  company?: string
  website?: string
  status?: string
  source?: string
  notes?: string
}) {
  try {
    const token = await getToken()
    // Status updates go via the dedicated endpoint
    if (fields.status && Object.keys(fields).length === 1) {
      await leadsApi.updateStatus(token, leadId, fields.status)
    } else {
      // For mixed updates get current data and merge
      const current = await leadsApi.get(token, leadId)
      await leadsApi.update(token, leadId, {
        name: fields.name ?? current.name,
        email: fields.email ?? current.email,
        phone: fields.phone ?? current.phone,
        company: fields.company ?? current.company,
        website: fields.website ?? current.website,
        source: fields.source ?? current.source,
        notes: fields.notes ?? current.notes,
      })
    }

    await logLeadEvent(leadId, 'Lead Updated', `Updated: ${Object.keys(fields).join(', ')}`)
    revalidatePath('/dashboard/leads')
    revalidatePath(`/dashboard/leads/${leadId}`)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function scheduleLeadAction(
  leadId: string,
  leadName: string,
  actionType: 'Callback Scheduled' | 'Follow-up Scheduled',
  scheduledAt: string,
  note?: string,
) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  const { error } = await supabase.from('lead_events').insert({
    lead_id: leadId,
    type: actionType,
    note: note?.trim() || null,
    metadata: { scheduled_at: scheduledAt },
    created_by: authData.user?.id ?? null,
  })

  if (error) return { error: error.message }

  try {
    const token = await getToken()
    await leadsApi.update(token, leadId, {
      name: (await leadsApi.get(token, leadId)).name,
      followUpDate: scheduledAt,
    })
  } catch {}

  const label = actionType === 'Callback Scheduled' ? 'Callback' : 'Follow-up'
  await supabase.from('enterprise_events').insert({
    title: `${label}: ${leadName}`,
    event_time: scheduledAt,
    event_type: label,
  }).then(() => {})

  revalidatePath(`/dashboard/leads/${leadId}`)
  revalidatePath('/dashboard/enterprise')
  return { success: true }
}

export async function setDoNotContact(leadId: string) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()

  const { error } = await supabase.from('lead_events').insert({
    lead_id: leadId,
    type: 'Do Not Contact',
    note: 'Lead marked as Do Not Contact — no further outreach.',
    created_by: authData.user?.id ?? null,
  })

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/leads/${leadId}`)
  return { success: true }
}
