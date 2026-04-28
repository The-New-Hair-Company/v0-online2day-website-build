'use server'

import { createClient } from '@/lib/supabase/server'

/// <reference types="node" />

const HUBSPOT_API_BASE = 'https://api.hubapi.com'
const HUBSPOT_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN

interface HubSpotContact {
    email: string
    firstname?: string
    lastname?: string
    company?: string
    phone?: string
    website?: string
    lifecyclestage?: string
    lead_source?: string
    [key: string]: string | undefined
}

async function hubspotFetch(path: string, options: RequestInit = {}) {
    const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${HUBSPOT_TOKEN}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    })

    if (!res.ok) {
        const errorBody = await res.text()
        throw new Error(`HubSpot API error ${res.status}: ${errorBody}`)
    }

    return res.json().catch(() => null)
}

/**
 * Search for a contact by email using HubSpot v3 API.
 */
async function searchContactByEmail(email: string): Promise<{ id: string } | null> {
    const result = await hubspotFetch('/crm/v3/objects/contacts/search', {
        method: 'POST',
        body: JSON.stringify({
            filterGroups: [
                {
                    filters: [
                        {
                            propertyName: 'email',
                            operator: 'EQ',
                            value: email,
                        },
                    ],
                },
            ],
            properties: ['email'],
            limit: 1,
        }),
    })

    const contacts = result?.results || []
    if (contacts.length > 0) {
        return { id: contacts[0].id }
    }
    return null
}

/**
 * Create or update a HubSpot contact using v3 API.
 * Searches by email first, then patches existing or creates new.
 */
export async function createHubSpotContact(contact: HubSpotContact) {
    if (!HUBSPOT_TOKEN) {
        throw new Error('HUBSPOT_ACCESS_TOKEN is not configured')
    }

    const properties: Record<string, string> = {}
    Object.entries(contact).forEach(([key, value]) => {
        if (value !== undefined && value !== '' && key !== 'email') {
            properties[key] = value
        }
    })

    // Search for existing contact by email
    const existing = await searchContactByEmail(contact.email)

    if (existing) {
        // Update existing contact
        const result = await hubspotFetch(`/crm/v3/objects/contacts/${existing.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ properties }),
        })
        return { vid: existing.id, ...result }
    }

    // Create new contact
    properties.email = contact.email
    const result = await hubspotFetch('/crm/v3/objects/contacts', {
        method: 'POST',
        body: JSON.stringify({ properties }),
    })
    return { vid: result.id, ...result }
}

/**
 * Create a note and associate it with a contact using v3 API.
 */
export async function createHubSpotNote(contactEmail: string, noteBody: string) {
    if (!HUBSPOT_TOKEN) {
        throw new Error('HUBSPOT_ACCESS_TOKEN is not configured')
    }

    // Find contact by email
    const contact = await searchContactByEmail(contactEmail)
    if (!contact) {
        throw new Error('Contact not found in HubSpot')
    }

    // Create note
    const note = await hubspotFetch('/crm/v3/objects/notes', {
        method: 'POST',
        body: JSON.stringify({
            properties: {
                hs_note_body: noteBody,
                hs_timestamp: new Date().toISOString(),
            },
        }),
    })

    // Associate note with contact using v4 associations API
    await hubspotFetch('/crm/v4/associations/notes/contacts/batch/create', {
        method: 'POST',
        body: JSON.stringify({
            inputs: [
                {
                    from: { id: note.id },
                    to: { id: contact.id },
                    type: 'note_to_contact',
                },
            ],
        }),
    })

    return note
}

/**
 * Handle contact form submission — creates a contact + note in HubSpot.
 */
export async function submitContactForm(data: {
    name: string
    email: string
    company?: string
    message: string
}) {
    if (!HUBSPOT_TOKEN) {
        throw new Error('HUBSPOT_ACCESS_TOKEN is not configured')
    }

    const [firstname = '', lastname = ''] = data.name.trim().split(/\s+/, 2)

    // 1. Create or update the contact
    const contact = await createHubSpotContact({
        email: data.email,
        firstname,
        lastname: lastname || firstname,
        company: data.company,
        lifecyclestage: 'subscriber',
        lead_source: 'online2day website contact form',
    })

    // 2. Add a note with their message
    await createHubSpotNote(data.email, `Contact Form Message:\n\n${data.message}`)

    // 3. Save to Supabase Leads Table for the Dashboard
    const supabase = await createClient()
    
    // Check if lead already exists in Supabase to avoid duplicates
    const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('email', data.email)
        .single()
        
    if (!existingLead) {
        await supabase.from('leads').insert({
            name: data.name,
            email: data.email,
            company: data.company || '',
            notes: data.message,
            source: 'Website Contact Form',
            status: 'New',
        })
    } else {
        // Optionally log an event that they submitted the form again
        await supabase.from('lead_events').insert({
            lead_id: existingLead.id,
            type: 'Form Submission',
            note: `Submitted contact form again:\n\n${data.message}`
        })
    }

    return { success: true, contactId: contact.vid }
}

/**
 * Handle new user sign-up — creates a HubSpot contact from Supabase auth user.
 * Non-blocking: failures are caught silently so sign-up flow is never broken.
 */
export async function createHubSpotContactFromSignUp(data: {
    email: string
    source?: string
}) {
    if (!HUBSPOT_TOKEN) {
        console.warn('HUBSPOT_ACCESS_TOKEN missing — skipping HubSpot contact creation')
        return { success: false, reason: 'not_configured' }
    }

    try {
        const contact = await createHubSpotContact({
            email: data.email,
            lifecyclestage: 'lead',
            lead_source: data.source || 'online2day website sign-up',
        })

        return { success: true, contactId: contact.vid }
    } catch (error) {
        console.error('HubSpot contact creation failed:', error)
        return { success: false, reason: 'api_error', error: String(error) }
    }
}
