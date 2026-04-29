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

export async function logLeadEvent(leadId: string, type: string, note?: string) {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  const { error } = await supabase.from('lead_events').insert({
    lead_id: leadId,
    type,
    note: note || '',
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
