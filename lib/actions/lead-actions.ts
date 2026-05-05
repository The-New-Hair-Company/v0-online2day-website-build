'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createLead(formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const company = formData.get('company') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const source = formData.get('source') as string
  const notes = formData.get('notes') as string
  const website = formData.get('website') as string

  if (!name) {
    return { error: 'Name is required' }
  }

  const { data: user } = await supabase.auth.getUser()

  const { data, error } = await supabase.from('leads').insert({
    name,
    company,
    email,
    phone,
    source,
    notes,
    website,
    status: 'New',
    assigned_to: user.user?.id || null,
  }).select().single()

  if (error) {
    console.error('Error creating lead:', error)
    return { error: error.message }
  }

  // Log creation event
  if (data) {
    await logLeadEvent(data.id, 'Lead Created', `Lead created by ${user.user?.email || 'unknown'}`)
  }

  revalidatePath('/dashboard/leads')
  return { data }
}

export async function updateLead(leadId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  const name = formData.get('name') as string
  const company = formData.get('company') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const source = formData.get('source') as string
  const notes = formData.get('notes') as string
  const website = formData.get('website') as string
  const status = formData.get('status') as string
  const follow_up_date = formData.get('follow_up_date') as string

  if (!name) {
    return { error: 'Name is required' }
  }

  const { error } = await supabase
    .from('leads')
    .update({
      name,
      company,
      email,
      phone,
      source,
      notes,
      website,
      status,
      follow_up_date: follow_up_date || null,
      updated_at: new Date().toISOString(),
      assigned_to: user.user?.id || null,
    })
    .eq('id', leadId)

  if (error) {
    console.error('Error updating lead:', error)
    return { error: error.message }
  }

  await logLeadEvent(leadId, 'Lead Updated', `Contact details updated by ${user.user?.email || 'unknown'}`)

  revalidatePath('/dashboard/leads')
  revalidatePath(`/dashboard/leads/${leadId}`)
  return { success: true }
}

export async function deleteLead(leadId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', leadId)

  if (error) {
    console.error('Error deleting lead:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/leads')
  redirect('/dashboard/leads')
}

export async function updateLeadStatus(leadId: string, status: string) {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) {
    return { error: error.message }
  }

  await logLeadEvent(leadId, 'Status Updated', `Status changed to "${status}" by ${user.user?.email || 'unknown'}`)
  revalidatePath(`/dashboard/leads`)
  revalidatePath(`/dashboard/leads/${leadId}`)

  return { success: true }
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
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  if (!data.name?.trim()) return { error: 'Name is required.' }

  const numericValue = data.value
    ? Number(data.value.replace(/[^0-9.]/g, '')) || null
    : null

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      name: data.name.trim(),
      company: data.company?.trim() || null,
      role: data.role?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      linkedin_url: data.linkedin?.trim() || null,
      source: data.source || 'Website',
      status: data.stage || 'New',
      value: numericValue,
      notes: data.notes?.trim() || null,
      assigned_to: user.user?.id || null,
    })
    .select()
    .single()

  if (error) {
    console.error('createLeadFromObject error:', error)
    return { error: error.message }
  }

  if (lead) {
    await logLeadEvent(lead.id, 'Lead Created', `Lead created: ${data.name}`)
    await supabase.from('activity_feed').insert({
      actor_name: user.user?.email || 'Admin',
      type: 'lead_created',
      entity_type: 'lead',
      entity_id: lead.id,
      entity_name: data.name,
      description: `New lead added: ${data.name}${data.company ? ` (${data.company})` : ''}`,
    })
  }

  revalidatePath('/dashboard/leads')
  revalidatePath('/dashboard/overview')
  return { success: true, lead }
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

  if (data.leadId) {
    revalidatePath(`/dashboard/leads/${data.leadId}`)
  }
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

  if (error) {
    console.error('Error logging event:', error)
  }
}

export async function addLeadNote(leadId: string, note: string) {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  const { error } = await supabase.from('lead_events').insert({
    lead_id: leadId,
    type: 'Note Added',
    note,
    created_by: user.user?.id || null,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/dashboard/leads/${leadId}`)
  return { success: true }
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
  const supabase = await createClient()

  const { error } = await supabase
    .from('leads')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) return { error: error.message }

  await logLeadEvent(leadId, 'Lead Updated', `Updated: ${Object.keys(fields).join(', ')}`)
  revalidatePath('/dashboard/leads')
  revalidatePath(`/dashboard/leads/${leadId}`)
  return { success: true }
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

  await supabase
    .from('leads')
    .update({ follow_up_date: scheduledAt, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  const label = actionType === 'Callback Scheduled' ? 'Callback' : 'Follow-up'
  await supabase.from('enterprise_events').insert({
    title: `${label}: ${leadName}`,
    event_time: scheduledAt,
    event_type: label,
  }).then(() => {}) // non-fatal

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
