'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAsyncActionFailure, withRetry } from './reliability-actions'

export async function fetchHubspotContacts() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) return { error: 'No Hubspot token found' }

  try {
    const response = await withRetry(
      'hubspot_fetch_contacts',
      () => fetch('https://api.hubapi.com/crm/v3/objects/contacts?properties=firstname,lastname,email,phone,company', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 60 },
      }),
      { attempts: 3, payload: { endpoint: 'crm/v3/objects/contacts' } },
    )

    if (!response.ok) {
      const detail = await response.text()
      await logAsyncActionFailure({
        action: 'hubspot_fetch_contacts',
        payload: { endpoint: 'crm/v3/objects/contacts' },
        error: new Error(`HubSpot status ${response.status}: ${detail}`),
        recoverable: true,
      })
      return { error: 'Failed to fetch Hubspot contacts' }
    }

    const data = await response.json()
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
