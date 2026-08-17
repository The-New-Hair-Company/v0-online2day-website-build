import 'server-only'

const HUBSPOT_API_BASE = 'https://api.hubapi.com'
const DEFAULT_PIPELINE = 'default'
const NEW_ENQUIRY_STAGE = 'appointmentscheduled'

const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
  'icloud.com', 'me.com', 'yahoo.com', 'proton.me', 'protonmail.com',
])

type HubSpotRecord = { id: string; properties?: Record<string, string | null> }

export type Online2DayBrief = {
  submissionId: string
  plan: string
  projectType: string
  pages: string
  features: string[]
  timeline: string
  budget: string
  name: string
  email: string
  company: string
  notes: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  referrer?: string
}

function token() {
  const value = process.env.HUBSPOT_ACCESS_TOKEN
  if (!value) throw new Error('HUBSPOT_ACCESS_TOKEN is not configured')
  return value
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function hubspotFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${HUBSPOT_API_BASE}${path}`, {
        ...init,
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
      })

      if (response.ok) {
        if (response.status === 204) return undefined as T
        return await response.json() as T
      }

      const body = (await response.text()).slice(0, 500)
      lastError = new Error(`HubSpot request failed (${response.status}): ${body}`)
      if (response.status !== 429 && response.status < 500) break
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('HubSpot request failed')
    }

    if (attempt < 2) await wait(250 * 2 ** attempt)
  }

  throw lastError || new Error('HubSpot request failed')
}

async function findContact(email: string) {
  const path = `/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email&properties=email,firstname,lastname,company,hubspot_owner_id`
  try {
    return await hubspotFetch<HubSpotRecord>(path)
  } catch (error) {
    if (error instanceof Error && error.message.includes('(404)')) return null
    throw error
  }
}

async function upsertContact(brief: Online2DayBrief, ownerId?: string) {
  const [firstname = '', ...surnameParts] = brief.name.trim().split(/\s+/)
  const existing = await findContact(brief.email)
  const properties: Record<string, string> = {
    email: brief.email,
    firstname,
    lastname: surnameParts.join(' '),
    lifecyclestage: 'lead',
  }
  if (brief.company) properties.company = brief.company
  if (ownerId) properties.hubspot_owner_id = ownerId

  if (existing) {
    delete properties.email
    delete properties.lifecyclestage
    return hubspotFetch<HubSpotRecord>(`/crm/v3/objects/contacts/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    })
  }

  return hubspotFetch<HubSpotRecord>('/crm/v3/objects/contacts', {
    method: 'POST',
    body: JSON.stringify({ properties }),
  })
}

function workEmailDomain(email: string) {
  const domain = email.split('@')[1]?.toLowerCase()
  return domain && !PUBLIC_EMAIL_DOMAINS.has(domain) ? domain : null
}

async function upsertCompany(brief: Online2DayBrief, ownerId?: string) {
  const domain = workEmailDomain(brief.email)
  if (!domain) return null

  const search = await hubspotFetch<{ results: HubSpotRecord[] }>('/crm/v3/objects/companies/search', {
    method: 'POST',
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'domain', operator: 'EQ', value: domain }] }],
      properties: ['domain', 'name', 'hubspot_owner_id'],
      limit: 1,
    }),
  })
  const existing = search.results[0]
  const properties: Record<string, string> = { domain, name: brief.company || domain }
  if (ownerId) properties.hubspot_owner_id = ownerId

  if (existing) {
    return hubspotFetch<HubSpotRecord>(`/crm/v3/objects/companies/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    })
  }

  return hubspotFetch<HubSpotRecord>('/crm/v3/objects/companies', {
    method: 'POST',
    body: JSON.stringify({ properties }),
  })
}

async function getOwnerId() {
  const owners = await hubspotFetch<{ results: Array<{ id: string; email?: string; archived?: boolean }> }>(
    '/crm/v3/owners?limit=100&archived=false',
  )
  const preferred = process.env.HUBSPOT_OWNER_EMAIL?.trim().toLowerCase()
  return owners.results.find((owner) => owner.email?.toLowerCase() === preferred)?.id
    || owners.results.find((owner) => !owner.archived)?.id
}

function briefSummary(brief: Online2DayBrief) {
  return [
    `Project type: ${brief.projectType}`,
    `Package: ${brief.plan}`,
    `Pages/views: ${brief.pages}`,
    `Features: ${brief.features.length ? brief.features.join(', ') : 'None selected'}`,
    `Timeline: ${brief.timeline}`,
    `Budget: ${brief.budget}`,
    `Company: ${brief.company || 'Not supplied'}`,
    `Notes: ${brief.notes || 'None supplied'}`,
    '',
    'Marketing attribution',
    `UTM source: ${brief.utmSource || 'Not supplied'}`,
    `UTM medium: ${brief.utmMedium || 'Not supplied'}`,
    `UTM campaign: ${brief.utmCampaign || 'Not supplied'}`,
    `Referrer: ${brief.referrer || 'Direct / unavailable'}`,
    `Submission ID: ${brief.submissionId}`,
  ].join('\n')
}

function estimatedAmount(budget: string) {
  return ({ 'under-1k': '500', '1k-3k': '2000', '3k-8k': '5500', '8k+': '8000' } as Record<string, string>)[budget]
}

function closeDate(timeline: string) {
  const days = ({ asap: 14, '4-8-weeks': 42, '2-4-months': 84, flexible: 90 } as Record<string, number>)[timeline] || 60
  return new Date(Date.now() + days * 86_400_000).toISOString()
}

async function findDealBySubmissionId(submissionId: string) {
  const result = await hubspotFetch<{ results: HubSpotRecord[] }>('/crm/v3/objects/deals/search', {
    method: 'POST',
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'online2day_submission_id', operator: 'EQ', value: submissionId }] }],
      properties: ['dealname', 'dealstage', 'online2day_submission_id'],
      limit: 1,
    }),
  })
  return result.results[0] || null
}

async function createDeal(brief: Online2DayBrief, contactId: string, companyId?: string, ownerId?: string) {
  const existing = await findDealBySubmissionId(brief.submissionId)
  if (existing) return { ...existing, existing: true }

  const properties: Record<string, string> = {
    dealname: `${brief.company || brief.name} — ${brief.projectType.replaceAll('-', ' ')}`,
    pipeline: process.env.HUBSPOT_DEAL_PIPELINE || DEFAULT_PIPELINE,
    dealstage: process.env.HUBSPOT_NEW_ENQUIRY_STAGE || NEW_ENQUIRY_STAGE,
    closedate: closeDate(brief.timeline),
    description: briefSummary(brief),
    online2day_submission_id: brief.submissionId,
    online2day_plan: brief.plan,
  }
  const amount = estimatedAmount(brief.budget)
  if (amount) properties.amount = amount
  if (ownerId) properties.hubspot_owner_id = ownerId

  const associations = [
    { to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }] },
  ]
  if (companyId) {
    associations.push({ to: { id: companyId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 5 }] })
  }

  return hubspotFetch<HubSpotRecord>('/crm/v3/objects/deals', {
    method: 'POST',
    body: JSON.stringify({ properties, associations }),
  })
}

async function createNote(brief: Online2DayBrief, contactId: string, dealId: string) {
  return hubspotFetch<HubSpotRecord>('/crm/v3/objects/notes', {
    method: 'POST',
    body: JSON.stringify({
      properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `Online2Day website brief\n\n${briefSummary(brief)}` },
      associations: [
        { to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] },
        { to: { id: dealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] },
      ],
    }),
  })
}

async function createFollowUpTask(brief: Online2DayBrief, contactId: string, dealId: string, ownerId?: string) {
  const dueAt = Date.now() + (brief.timeline === 'asap' ? 30 : 120) * 60_000
  const properties: Record<string, string> = {
    hs_timestamp: new Date(dueAt).toISOString(),
    hs_task_subject: `Respond to ${brief.name} — ${brief.projectType.replaceAll('-', ' ')}`,
    hs_task_body: `Review the website brief and make first contact. Submission ${brief.submissionId}.`,
    hs_task_status: 'NOT_STARTED',
    hs_task_type: 'TODO',
  }
  if (brief.timeline === 'asap') properties.hs_task_priority = 'HIGH'
  if (ownerId) properties.hubspot_owner_id = ownerId

  return hubspotFetch<HubSpotRecord>('/crm/v3/objects/tasks', {
    method: 'POST',
    body: JSON.stringify({
      properties,
      associations: [
        { to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }] },
        { to: { id: dealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 216 }] },
      ],
    }),
  })
}

export async function syncOnline2DayBrief(brief: Online2DayBrief) {
  const ownerId = await getOwnerId()
  const contact = await upsertContact(brief, ownerId)
  const company = await upsertCompany(brief, ownerId)
  const deal = await createDeal(brief, contact.id, company?.id, ownerId)

  if (!('existing' in deal)) {
    await Promise.all([
      createNote(brief, contact.id, deal.id),
      createFollowUpTask(brief, contact.id, deal.id, ownerId),
    ])
  }

  return { contactId: contact.id, companyId: company?.id, dealId: deal.id }
}
