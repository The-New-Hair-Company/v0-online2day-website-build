'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { platformServerFetch } from '@/lib/api/platform-server'

interface HubSpotContact {
  email: string
  firstname?: string
  lastname?: string
  company?: string
  phone?: string
  website?: string
  lifecyclestage?: string
  lead_source?: string
}

async function accessToken() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('Not authenticated')
  return data.session.access_token
}

export async function createHubSpotContact(contact: HubSpotContact) {
  const parsed = z.object({
    email: z.string().trim().email().max(254),
    firstname: z.string().trim().max(100).optional(),
    lastname: z.string().trim().max(100).optional(),
    company: z.string().trim().max(160).optional(),
    phone: z.string().trim().max(80).optional(),
    website: z.string().trim().max(500).optional(),
    lifecyclestage: z.string().trim().max(80).optional(),
    lead_source: z.string().trim().max(120).optional(),
  }).parse(contact)
  const result = await platformServerFetch<{ id: string }>('/api/v1/integrations/hubspot/contacts/upsert', {
    method: 'POST',
    accessToken: await accessToken(),
    body: JSON.stringify(parsed),
  })
  return { vid: result.id, id: result.id }
}

export async function createHubSpotNote(contactEmail: string, noteBody: string) {
  const email = z.string().trim().email().max(254).parse(contactEmail)
  const note = z.string().trim().min(1).max(10_000).parse(noteBody)
  return platformServerFetch<{ id: string }>(
    `/api/v1/integrations/hubspot/contacts/${encodeURIComponent(email)}/notes`,
    {
      method: 'POST',
      accessToken: await accessToken(),
      body: JSON.stringify({ note }),
    },
  )
}

export async function submitContactForm(input: {
  name: string
  email: string
  company?: string
  message: string
}) {
  const data = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    company: z.string().trim().max(160).optional().default(''),
    message: z.string().trim().min(1).max(3_000),
  }).parse(input)
  const submissionId = crypto.randomUUID()
  const enquiry = {
    submissionId,
    plan: 'not-sure',
    projectType: 'website-enquiry',
    pages: 'not-supplied',
    features: [] as string[],
    timeline: 'flexible',
    budget: 'not-sure',
    name: data.name,
    email: data.email.toLowerCase(),
    company: data.company,
    notes: data.message,
  }
  const [hubspot, database] = await Promise.allSettled([
    platformServerFetch<{ contactId: string }>('/api/v1/integrations/hubspot/enquiries', {
      method: 'POST', serviceRequest: true, body: JSON.stringify(enquiry),
    }),
    platformServerFetch('/api/v1/online2day/contact-leads', {
      method: 'POST', serviceRequest: true, body: JSON.stringify(data),
    }),
  ])
  if (hubspot.status === 'rejected') {
    console.error('HubSpot contact sync failed', hubspot.reason instanceof Error ? hubspot.reason.message : 'Unknown error')
  }
  if (database.status === 'rejected') {
    console.error('Contact lead write failed', database.reason instanceof Error ? database.reason.message : 'Unknown error')
  }
  if (hubspot.status === 'rejected' && database.status === 'rejected') {
    throw new Error('The contact service is temporarily unavailable')
  }
  return { success: true, contactId: hubspot.status === 'fulfilled' ? hubspot.value.contactId : undefined }
}

export async function createHubSpotContactFromSignUp(input: { email: string; source?: string }) {
  try {
    const email = z.string().trim().email().max(254).parse(input.email)
    const result = await platformServerFetch<{ contactId: string }>('/api/v1/integrations/hubspot/signup', {
      method: 'POST', serviceRequest: true, body: JSON.stringify({ email: email.toLowerCase() }),
    })
    return { success: true, contactId: result.contactId }
  } catch (error) {
    console.error('HubSpot signup sync failed', error instanceof Error ? error.message : 'Unknown error')
    return { success: false, reason: 'api_error' }
  }
}
