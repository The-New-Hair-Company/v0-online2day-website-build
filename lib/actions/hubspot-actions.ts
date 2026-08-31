'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAsyncActionFailure, withRetry } from './reliability-actions'
import { platformServerFetch } from '@/lib/api/platform-server'

export async function fetchHubspotContacts() {
  try {
    const supabase = await createClient()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return { error: 'Not authenticated' }
    const data = await withRetry(
      'hubspot_fetch_contacts',
      () => platformServerFetch<{ results: unknown[] }>('/api/v1/integrations/hubspot/contacts?limit=100', {
        accessToken: token,
      }),
      { attempts: 3, payload: { endpoint: 'api/v1/integrations/hubspot/contacts' } },
    )
    return { data: data.results }
  } catch (err) {
    await logAsyncActionFailure({
      action: 'hubspot_fetch_contacts',
      payload: { endpoint: 'crm/v3/objects/contacts' },
      error: err,
      recoverable: true,
    })
    return { error: 'Error fetching Hubspot contacts' }
  }
}

export async function importHubspotContactToLead(contact: any) {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  const name = `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim()
  const email = contact.properties.email || ''
  const phone = contact.properties.phone || ''
  const company = contact.properties.company || ''

  // Check if lead already exists by email
  if (email) {
    const { data: existing } = await supabase.from('leads').select('id').eq('email', email).single()
    if (existing) {
      return { error: 'Lead with this email already exists in CRM' }
    }
  }

  const { data, error } = await supabase.from('leads').insert({
    name: name || 'Unknown Name',
    email,
    phone,
    company,
    source: 'HubSpot',
    status: 'New',
    assigned_to: user.user?.id || null,
  }).select().single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/leads')
  return { data }
}
