import Fastify, { type FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { z } from 'zod'
import { registerPlatformRoutes } from './platform-routes.js'
import { registerMediaRoutes } from './media-routes.js'
import { registerCompatRoutes } from './compat-routes.js'

const required = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

const config = {
  port: Number(process.env.PORT || 8080),
  coreApiUrl: new URL(required('CORE_API_URL')),
  supabaseIssuer: required('SUPABASE_ISSUER').replace(/\/$/, ''),
  supabaseAudience: process.env.SUPABASE_AUDIENCE || 'authenticated',
  supabaseUrl: required('SUPABASE_URL').replace(/\/$/, ''),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  hubspotAccessToken: required('HUBSPOT_ACCESS_TOKEN'),
  gatewayServerKey: required('GATEWAY_SERVER_KEY'),
  resendApiKey: process.env.RESEND_API_KEY?.trim() || '',
  siteUrl: (process.env.SITE_URL || 'https://www.online2day.com').replace(/\/$/, ''),
  emailFrom: process.env.EMAIL_FROM?.trim() || 'Online2Day <hello@online2day.com>',
  emailReplyTo: process.env.EMAIL_REPLY_TO?.trim() || 'hello@online2day.com',
  hubspotOwnerEmail: process.env.HUBSPOT_OWNER_EMAIL?.trim().toLowerCase(),
  hubspotDealPipeline: process.env.HUBSPOT_DEAL_PIPELINE || 'default',
  hubspotNewEnquiryStage: process.env.HUBSPOT_NEW_ENQUIRY_STAGE || 'appointmentscheduled',
  adminEmails: new Set((process.env.ADMIN_EMAILS || '')
    .split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)),
  allowedOrigins: new Set((process.env.ALLOWED_ORIGINS || '')
    .split(',').map((origin) => origin.trim()).filter(Boolean)),
}

const app = Fastify({
  logger: true,
  bodyLimit: 64 * 1024,
  requestTimeout: 12_000,
  trustProxy: true,
})

await app.register(cors, {
  origin(origin, callback) {
    if (!origin || config.allowedOrigins.has(origin)) return callback(null, true)
    return callback(null, false)
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  maxAge: 3600,
})

await app.register(rateLimit, {
  global: true,
  max: 300,
  timeWindow: '1 minute',
})

app.addHook('onSend', async (_request, reply, payload) => {
  reply.header('X-Content-Type-Options', 'nosniff')
  reply.header('Referrer-Policy', 'no-referrer')
  return payload
})

const jwks = createRemoteJWKSet(new URL(`${config.supabaseIssuer}/.well-known/jwks.json`), {
  cooldownDuration: 60_000,
  timeoutDuration: 5_000,
})
const authenticatedUsers = new WeakMap<FastifyRequest, Record<string, unknown>>()
const authorisedAdmins = new WeakSet<FastifyRequest>()

async function requireSupabaseUser(request: FastifyRequest) {
  const cached = authenticatedUsers.get(request)
  if (cached) return cached
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) throw unauthorized()
  try {
    const verified = await jwtVerify(header.slice(7), jwks, {
      issuer: config.supabaseIssuer,
      audience: config.supabaseAudience,
    })
    if (!verified.payload.sub) throw new Error('Missing subject')
    authenticatedUsers.set(request, verified.payload)
    return verified.payload
  } catch {
    throw unauthorized()
  }
}

async function requireSupabaseAdmin(request: FastifyRequest) {
  const user = await requireSupabaseUser(request)
  if (authorisedAdmins.has(request)) return user
  const userId = String(user.sub)
  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : ''
  if (email && config.adminEmails.has(email)) { authorisedAdmins.add(request); return user }

  const profiles = await supabaseFetch<Array<{ role: string | null }>>(
    `user_profiles?user_id=eq.${encodeURIComponent(userId)}&select=role&limit=1`,
    { headers: { Accept: 'application/json' } },
  )
  if (profiles[0]?.role === 'admin') { authorisedAdmins.add(request); return user }

  if (email) {
    const licensed = await supabaseFetch<Array<{ role: string | null; status: string | null }>>(
      `licensed_users?email=eq.${encodeURIComponent(email)}&select=role,status&limit=1`,
      { headers: { Accept: 'application/json' } },
    )
    if (licensed[0]?.role === 'admin' && licensed[0]?.status === 'active') { authorisedAdmins.add(request); return user }
  }
  throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
}

function unauthorized() {
  return Object.assign(new Error('Unauthorized'), { statusCode: 401 })
}

async function requireServerKey(request: FastifyRequest) {
  const supplied = request.headers['x-online2day-gateway-key']
  if (typeof supplied !== 'string' || supplied.length !== config.gatewayServerKey.length) {
    throw unauthorized()
  }
  let mismatch = 0
  for (let index = 0; index < supplied.length; index += 1) {
    mismatch |= supplied.charCodeAt(index) ^ config.gatewayServerKey.charCodeAt(index)
  }
  if (mismatch !== 0) throw unauthorized()
}

async function requestJson<T>(url: string, init: RequestInit, attempts = 3): Promise<T> {
  let finalError: Error | undefined
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8_000) })
      if (response.ok) {
        if (response.status === 204) return undefined as T
        const text = await response.text()
        return (text ? JSON.parse(text) : undefined) as T
      }
      const detail = (await response.text()).slice(0, 1_000)
      finalError = new Error(`Upstream request failed (${response.status}): ${detail}`)
      if (response.status !== 429 && response.status < 500) break
    } catch (error) {
      finalError = error instanceof Error ? error : new Error('Upstream request failed')
    }
    if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt))
  }
  throw finalError || new Error('Upstream request failed')
}

type HubSpotRecord = { id: string; properties?: Record<string, string | null> }

function hubspotFetch<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${config.hubspotAccessToken}`)
  if (init.body != null && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return requestJson<T>(`https://api.hubapi.com${path}`, {
    ...init,
    headers,
  })
}

async function supabaseFetch<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('apikey', config.supabaseServiceRoleKey)
  headers.set('Authorization', `Bearer ${config.supabaseServiceRoleKey}`)
  if (init.body != null && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return requestJson<T>(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers,
  }, 2)
}

async function supabaseStorageFetch<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('apikey', config.supabaseServiceRoleKey)
  headers.set('Authorization', `Bearer ${config.supabaseServiceRoleKey}`)
  if (init.body != null && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return requestJson<T>(`${config.supabaseUrl}/storage/v1/${path}`, {
    ...init,
    headers,
  }, 2)
}

const contactSchema = z.object({
  email: z.string().trim().email().max(254),
  firstname: z.string().trim().max(100).optional(),
  lastname: z.string().trim().max(100).optional(),
  company: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(80).optional(),
  website: z.string().trim().max(500).optional(),
  lifecyclestage: z.string().trim().max(80).optional(),
  lead_source: z.string().trim().max(120).optional(),
})

const enquirySchema = z.object({
  submissionId: z.string().uuid(),
  plan: z.string().trim().min(1).max(80),
  projectType: z.string().trim().min(1).max(80),
  pages: z.string().trim().max(80),
  features: z.array(z.string().trim().min(1).max(80)).max(12),
  timeline: z.string().trim().max(80),
  budget: z.string().trim().max(80),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().max(160),
  notes: z.string().trim().max(3_000),
  utmSource: z.string().trim().max(160).optional().default(''),
  utmMedium: z.string().trim().max(160).optional().default(''),
  utmCampaign: z.string().trim().max(200).optional().default(''),
  referrer: z.string().trim().max(500).optional().default(''),
})

const videoAssetMetadataSchema = z.record(z.string(), z.unknown()).refine(
  (value) => JSON.stringify(value).length <= 48_000,
  'Video project metadata is too large.',
)

const videoAssetCreateSchema = z.object({
  leadId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(160),
  url: z.string().trim().url().max(2_000).optional(),
  storagePath: z.string().trim().max(700).optional().default(''),
  publicUrl: z.string().trim().url().max(2_000).nullable().optional(),
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{2,159}$/),
  metadata: videoAssetMetadataSchema.optional().default({}),
})

const videoAssetUpdateSchema = z.object({
  leadId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(160).optional(),
  url: z.string().trim().url().max(2_000).optional(),
  storagePath: z.string().trim().max(700).optional(),
  publicUrl: z.string().trim().url().max(2_000).nullable().optional(),
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{2,159}$/).optional(),
  metadata: videoAssetMetadataSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one video asset field is required.')

const emailTemplateCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(20_000),
  category: z.string().trim().max(80).optional().default('Outreach'),
  audience: z.string().trim().max(120).optional().default('All leads'),
  stage: z.string().trim().max(80).optional().default('Outreach'),
  ctaLabel: z.string().trim().max(80).optional().default('Reply now'),
})

const emailTemplateUpdateSchema = emailTemplateCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one email template field is required.',
)

const emailSendSchema = z.object({
  leadId: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
  to: z.string().trim().email().max(254),
  subject: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(20_000),
  resendId: z.string().trim().min(1).max(160),
})

const sendEmailSchema = z.object({
  leadId: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
  to: z.string().trim().email().max(254),
  recipientName: z.string().trim().max(160).optional(),
  subject: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(20_000),
  templateName: z.string().trim().max(120).optional(),
  videoAssetId: z.string().uuid().optional(),
  videoSlug: z.string().trim().max(180).optional(),
  ctaLabel: z.string().trim().max(100).optional(),
  idempotencyKey: z.string().trim().min(8).max(180),
})

const emailEventSchema = z.object({
  eventId: z.string().trim().min(1).max(200),
  emailId: z.string().trim().min(1).max(160),
  eventType: z.enum([
    'email.sent', 'email.delivered', 'email.delivery_delayed', 'email.opened',
    'email.clicked', 'email.bounced', 'email.complained', 'email.failed', 'email.suppressed',
  ]),
  createdAt: z.string().datetime().optional(),
})

const siteRequestUpdateSchema = z.object({
  stage: z.string().trim().min(1).max(80).optional(),
  priority: z.enum(['Low', 'Medium', 'High']).optional(),
  nextAction: z.string().trim().min(1).max(240).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one site request field is required.')

type VideoAssetRow = {
  id: string
  lead_id: string | null
  name: string
  type: string
  url: string | null
  storage_path: string | null
  public_url: string | null
  slug: string | null
  metadata: Record<string, unknown> | string | null
  view_count: number | null
  created_at: string
  lead?: { id: string; name: string | null; company: string | null; status: string | null; email: string | null } | null
}

const videoAssetSelect = 'id,lead_id,name,type,url,storage_path,public_url,slug,metadata,view_count,created_at,lead:leads(id,name,company,status,email)'

function escapeEmailHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderEmailHtml(input: {
  recipientName?: string
  body: string
  videoUrl?: string | null
  videoTitle?: string | null
  ctaLabel?: string
}) {
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px;color:#d6deea;line-height:1.65">${escapeEmailHtml(paragraph).replaceAll('\n', '<br/>')}</p>`)
    .join('')
  const safeVideoUrl = input.videoUrl ? escapeEmailHtml(input.videoUrl) : ''

  return `
    <div style="margin:0;padding:0;background:#05070b;font-family:Inter,Arial,sans-serif;color:#f7f9ff">
      <table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="background:#05070b;padding:32px 16px">
        <tr><td align="center">
          <table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="max-width:680px;border:1px solid #20304f;border-radius:16px;overflow:hidden;background:#0c121d">
            <tr><td style="padding:24px 28px;border-bottom:1px solid #20304f">
              <div style="font-size:24px;font-weight:800;color:#4d86ff">Online2Day</div>
              <div style="margin-top:6px;color:#8f9caf;font-size:13px">Personalised client communication</div>
            </td></tr>
            <tr><td style="padding:28px">
              ${input.recipientName ? `<p style="margin:0 0 16px;color:#f7f9ff;font-size:18px;font-weight:700">Hi ${escapeEmailHtml(input.recipientName)},</p>` : ''}
              ${paragraphs}
              ${safeVideoUrl ? `<a href="${safeVideoUrl}" style="display:block;margin:24px 0;padding:20px;border:1px solid #2f6bff;border-radius:12px;background:#08152d;text-decoration:none"><span style="display:block;color:#72aeff;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em">Personalised video</span><strong style="display:block;margin-top:8px;color:#fff;font-size:18px">${escapeEmailHtml(input.videoTitle || 'Watch your video')}</strong><span style="display:inline-block;margin-top:14px;padding:10px 16px;border-radius:8px;background:#2f6bff;color:#fff;font-weight:800">${escapeEmailHtml(input.ctaLabel || 'Watch video')}</span></a>` : ''}
              <p style="margin:22px 0 0;color:#8f9caf;font-size:12px;line-height:1.6">Sent securely from the Online2Day CRM. Engagement is recorded through the authenticated Online2Day API.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </div>
  `
}

async function resolveEmailVideo(videoAssetId?: string, videoSlug?: string) {
  if (videoSlug) return { url: `${config.siteUrl}/v/${encodeURIComponent(videoSlug)}`, title: 'Personalised video' }
  if (!videoAssetId) return { url: null, title: null }
  const rows = await supabaseFetch<Array<Pick<VideoAssetRow, 'id' | 'name' | 'slug' | 'url' | 'storage_path'>>>(
    `lead_assets?id=eq.${encodeURIComponent(videoAssetId)}&type=eq.video&select=id,name,slug,url,storage_path&limit=1`,
    { headers: { Accept: 'application/json' } },
  )
  const asset = rows[0]
  if (!asset) throw Object.assign(new Error('Video asset not found.'), { statusCode: 404 })
  if (asset.slug) return { url: `${config.siteUrl}/v/${encodeURIComponent(asset.slug)}`, title: asset.name }
  if (!asset.storage_path) return { url: asset.url || null, title: asset.name }
  const objectPath = asset.storage_path.split('/').map(encodeURIComponent).join('/')
  const signed = await supabaseStorageFetch<{ signedURL?: string; signedUrl?: string }>(
    `object/sign/lead-videos/${objectPath}`,
    { method: 'POST', body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 14 }) },
  )
  const signedPath = signed.signedURL || signed.signedUrl
  return { url: signedPath ? `${config.supabaseUrl}/storage/v1${signedPath}` : asset.url || null, title: asset.name }
}

async function recordEmailSend(userId: string, body: z.infer<typeof emailSendSchema>) {
  const rows = await supabaseFetch<Array<Record<string, unknown>>>(
    'emails?select=id,lead_id,template_id,subject,body,status,sent_at,opened_at,clicked_at,replied_at,created_at',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        lead_id: body.leadId || null,
        sender_id: userId,
        template_id: body.templateId || null,
        subject: body.subject,
        body: body.body,
        status: `sent:${body.resendId}`,
        sent_at: new Date().toISOString(),
      }),
    },
  )
  const emailRecord = rows[0]
  if (!emailRecord) throw new Error('Email send could not be recorded.')

  if (body.templateId) {
    const templates = await supabaseFetch<Array<{ sent_count: number | null }>>(
      `email_templates?id=eq.${encodeURIComponent(body.templateId)}&select=sent_count&limit=1`,
      { headers: { Accept: 'application/json' } },
    )
    await supabaseFetch(`email_templates?id=eq.${encodeURIComponent(body.templateId)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
        sent_count: Math.max(0, templates[0]?.sent_count || 0) + 1,
        updated_at: new Date().toISOString(),
      }),
    })
  }

  if (body.leadId) {
    await supabaseFetch('lead_events', {
      method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
        lead_id: body.leadId,
        type: 'Email Sent',
        title: body.subject,
        note: `Email sent to ${body.to}`,
        created_by: userId,
        metadata: {
          resendId: body.resendId,
          emailRecordId: emailRecord.id,
          templateId: body.templateId || null,
          recipient: body.to,
        },
      }),
    })
  }
  return emailRecord
}

type Enquiry = z.infer<typeof enquirySchema>
const publicEmailDomains = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com',
  'me.com', 'yahoo.com', 'proton.me', 'protonmail.com',
])

async function findContact(email: string) {
  try {
    return await hubspotFetch<HubSpotRecord>(
      `/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email&properties=email,firstname,lastname,company,hubspot_owner_id`,
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('(404)')) return null
    throw error
  }
}

async function upsertContact(properties: z.infer<typeof contactSchema>, ownerId?: string) {
  const existing = await findContact(properties.email)
  const cleaned = Object.fromEntries(Object.entries(properties)
    .filter(([, value]) => value !== undefined && value !== '')) as Record<string, string>
  if (ownerId) cleaned.hubspot_owner_id = ownerId
  if (existing) {
    delete cleaned.email
    delete cleaned.lifecyclestage
    return hubspotFetch<HubSpotRecord>(`/crm/v3/objects/contacts/${existing.id}`, {
      method: 'PATCH', body: JSON.stringify({ properties: cleaned }),
    })
  }
  return hubspotFetch<HubSpotRecord>('/crm/v3/objects/contacts', {
    method: 'POST', body: JSON.stringify({ properties: cleaned }),
  })
}

async function ownerId() {
  const owners = await hubspotFetch<{ results: Array<{ id: string; email?: string; archived?: boolean }> }>(
    '/crm/v3/owners?limit=100&archived=false',
  )
  return owners.results.find((owner) => owner.email?.toLowerCase() === config.hubspotOwnerEmail)?.id
    || owners.results.find((owner) => !owner.archived)?.id
}

function workEmailDomain(email: string) {
  const domain = email.split('@')[1]?.toLowerCase()
  return domain && !publicEmailDomains.has(domain) ? domain : null
}

async function upsertCompany(enquiry: Enquiry, assignedOwnerId?: string) {
  const domain = workEmailDomain(enquiry.email)
  if (!domain) return null
  const search = await hubspotFetch<{ results: HubSpotRecord[] }>('/crm/v3/objects/companies/search', {
    method: 'POST',
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'domain', operator: 'EQ', value: domain }] }],
      properties: ['domain', 'name', 'hubspot_owner_id'], limit: 1,
    }),
  })
  const properties: Record<string, string> = { domain, name: enquiry.company || domain }
  if (assignedOwnerId) properties.hubspot_owner_id = assignedOwnerId
  const existing = search.results[0]
  return existing
    ? hubspotFetch<HubSpotRecord>(`/crm/v3/objects/companies/${existing.id}`, {
        method: 'PATCH', body: JSON.stringify({ properties }),
      })
    : hubspotFetch<HubSpotRecord>('/crm/v3/objects/companies', {
        method: 'POST', body: JSON.stringify({ properties }),
      })
}

function briefSummary(enquiry: Enquiry) {
  return [
    `Project type: ${enquiry.projectType}`, `Package: ${enquiry.plan}`,
    `Pages/views: ${enquiry.pages}`,
    `Features: ${enquiry.features.length ? enquiry.features.join(', ') : 'None selected'}`,
    `Timeline: ${enquiry.timeline}`, `Budget: ${enquiry.budget}`,
    `Company: ${enquiry.company || 'Not supplied'}`, `Notes: ${enquiry.notes || 'None supplied'}`,
    '', 'Marketing attribution', `UTM source: ${enquiry.utmSource || 'Not supplied'}`,
    `UTM medium: ${enquiry.utmMedium || 'Not supplied'}`,
    `UTM campaign: ${enquiry.utmCampaign || 'Not supplied'}`,
    `Referrer: ${enquiry.referrer || 'Direct / unavailable'}`,
    `Submission ID: ${enquiry.submissionId}`,
  ].join('\n')
}

async function syncEnquiry(enquiry: Enquiry) {
  const assignedOwnerId = await ownerId()
  const [firstName = '', ...surname] = enquiry.name.trim().split(/\s+/)
  const contact = await upsertContact({
    email: enquiry.email.toLowerCase(), firstname: firstName, lastname: surname.join(' '),
    company: enquiry.company, lifecyclestage: 'lead',
  }, assignedOwnerId)
  const company = await upsertCompany(enquiry, assignedOwnerId)
  const deals = await hubspotFetch<{ results: HubSpotRecord[] }>('/crm/v3/objects/deals/search', {
    method: 'POST',
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'online2day_submission_id', operator: 'EQ', value: enquiry.submissionId }] }],
      properties: ['dealname', 'dealstage', 'online2day_submission_id'], limit: 1,
    }),
  })
  if (deals.results[0]) return { contactId: contact.id, companyId: company?.id, dealId: deals.results[0].id }

  const closeDays = ({ asap: 14, '4-8-weeks': 42, '2-4-months': 84, flexible: 90 } as Record<string, number>)[enquiry.timeline] || 60
  const amount = ({ 'under-1k': '500', '1k-3k': '2000', '3k-8k': '5500', '8k+': '8000' } as Record<string, string>)[enquiry.budget]
  const properties: Record<string, string> = {
    dealname: `${enquiry.company || enquiry.name} — ${enquiry.projectType.replaceAll('-', ' ')}`,
    pipeline: config.hubspotDealPipeline, dealstage: config.hubspotNewEnquiryStage,
    closedate: new Date(Date.now() + closeDays * 86_400_000).toISOString(),
    description: briefSummary(enquiry), online2day_submission_id: enquiry.submissionId,
    online2day_plan: enquiry.plan,
  }
  if (amount) properties.amount = amount
  if (assignedOwnerId) properties.hubspot_owner_id = assignedOwnerId
  const associations = [{ to: { id: contact.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }] }]
  if (company) associations.push({ to: { id: company.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 5 }] })
  const deal = await hubspotFetch<HubSpotRecord>('/crm/v3/objects/deals', {
    method: 'POST', body: JSON.stringify({ properties, associations }),
  })
  await Promise.all([
    hubspotFetch('/crm/v3/objects/notes', {
      method: 'POST',
      body: JSON.stringify({
        properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `Online2Day website brief\n\n${briefSummary(enquiry)}` },
        associations: [
          { to: { id: contact.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] },
          { to: { id: deal.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] },
        ],
      }),
    }),
    hubspotFetch('/crm/v3/objects/tasks', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          hs_timestamp: new Date(Date.now() + (enquiry.timeline === 'asap' ? 30 : 120) * 60_000).toISOString(),
          hs_task_subject: `Respond to ${enquiry.name} — ${enquiry.projectType.replaceAll('-', ' ')}`,
          hs_task_body: `Review the website brief and make first contact. Submission ${enquiry.submissionId}.`,
          hs_task_status: 'NOT_STARTED', hs_task_type: 'TODO',
          ...(enquiry.timeline === 'asap' ? { hs_task_priority: 'HIGH' } : {}),
          ...(assignedOwnerId ? { hubspot_owner_id: assignedOwnerId } : {}),
        },
        associations: [
          { to: { id: contact.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }] },
          { to: { id: deal.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 216 }] },
        ],
      }),
    }),
  ])
  return { contactId: contact.id, companyId: company?.id, dealId: deal.id }
}

registerPlatformRoutes(app, {
  config: {
    supabaseUrl: config.supabaseUrl,
    supabaseServiceRoleKey: config.supabaseServiceRoleKey,
    resendApiKey: config.resendApiKey,
    siteUrl: config.siteUrl,
    emailFrom: config.emailFrom,
    emailReplyTo: config.emailReplyTo,
    gatewayServerKey: config.gatewayServerKey,
  },
  requireAdmin: requireSupabaseAdmin,
  requireServerKey,
  requestJson,
  supabaseFetch,
  supabaseStorageFetch,
})

registerMediaRoutes(app, {
  config: { supabaseUrl: config.supabaseUrl, supabaseServiceRoleKey: config.supabaseServiceRoleKey },
  requireAdmin: requireSupabaseAdmin,
  supabaseFetch,
  supabaseStorageFetch,
})

registerCompatRoutes(app, {
  requireAdmin: requireSupabaseAdmin,
  supabaseFetch,
})

app.get('/health/live', async () => ({ status: 'Healthy' }))
app.get('/health/ready', async (_request, reply) => {
  const started = performance.now()
  const response = await fetch(new URL('/health/ready', config.coreApiUrl), { signal: AbortSignal.timeout(5_000) }).catch(() => null)
  if (!response?.ok) return reply.code(503).send({ status: 'Unhealthy', coreApi: false })
  return { status: 'Healthy', coreApi: true, durationMs: Math.round(performance.now() - started) }
})

app.get('/api/v1/integrations/hubspot/contacts', {
  preHandler: requireSupabaseAdmin,
}, async (request) => {
  const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), after: z.string().optional() }).parse(request.query)
  const params = new URLSearchParams({ limit: String(query.limit), properties: 'firstname,lastname,email,phone,company' })
  if (query.after) params.set('after', query.after)
  return hubspotFetch(`/crm/v3/objects/contacts?${params}`)
})

app.post('/api/v1/integrations/hubspot/contacts/upsert', {
  preHandler: requireSupabaseAdmin,
}, async (request) => {
  const contact = contactSchema.parse(request.body)
  const result = await upsertContact(contact)
  return { id: result.id }
})

app.post('/api/v1/integrations/hubspot/contacts/:email/notes', {
  preHandler: requireSupabaseAdmin,
}, async (request, reply) => {
  const params = z.object({ email: z.string().email().max(254) }).parse(request.params)
  const body = z.object({ note: z.string().trim().min(1).max(10_000) }).parse(request.body)
  const contact = await findContact(params.email)
  if (!contact) return reply.code(404).send({ error: 'Contact not found in HubSpot' })
  const note = await hubspotFetch<HubSpotRecord>('/crm/v3/objects/notes', {
    method: 'POST',
    body: JSON.stringify({
      properties: { hs_note_body: body.note, hs_timestamp: new Date().toISOString() },
      associations: [
        { to: { id: contact.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] },
      ],
    }),
  })
  return reply.code(201).send({ id: note.id })
})

app.post('/api/v1/integrations/hubspot/enquiries', {
  config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
  preHandler: requireServerKey,
}, async (request, reply) => {
  const enquiry = enquirySchema.parse(request.body)
  const result = await syncEnquiry(enquiry)
  return reply.code(201).send(result)
})

app.post('/api/v1/integrations/hubspot/signup', {
  config: { rateLimit: { max: 60, timeWindow: '15 minutes' } },
  preHandler: requireServerKey,
}, async (request, reply) => {
  const body = z.object({ email: z.string().trim().email().max(254) }).parse(request.body)
  const contact = await upsertContact({ email: body.email.toLowerCase(), lifecyclestage: 'lead' })
  return reply.code(201).send({ contactId: contact.id })
})

app.post('/api/v1/online2day/site-requests', {
  config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
  preHandler: requireServerKey,
}, async (request, reply) => {
  const body = z.object({
    id: z.string().uuid(), title: z.string().max(200), company: z.string().max(160),
    type: z.string().max(80), priority: z.string().max(40), stage: z.string().max(40),
    contact_name: z.string().max(120), contact_email: z.string().email().max(254),
    description: z.string().max(4_000), budget_min: z.number(), budget_max: z.number(),
    timeline_weeks: z.number(), next_action: z.string().max(200),
  }).parse(request.body)
  await supabaseFetch('site_requests', {
    method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body),
  })
  return reply.code(201).send({ id: body.id })
})

app.post('/api/v1/online2day/contact-leads', {
  config: { rateLimit: { max: 30, timeWindow: '15 minutes' } },
  preHandler: requireServerKey,
}, async (request, reply) => {
  const body = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    company: z.string().trim().max(160).default(''),
    message: z.string().trim().min(1).max(3_000),
  }).parse(request.body)
  const email = body.email.toLowerCase()
  const encodedEmail = encodeURIComponent(email)
  const existing = await supabaseFetch<Array<{ id: string }>>(`leads?email=eq.${encodedEmail}&select=id&limit=1`, {
    headers: { Accept: 'application/json' },
  })
  if (existing[0]) {
    await supabaseFetch('lead_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        lead_id: existing[0].id,
        type: 'Form Submission',
        note: `Submitted contact form again:\n\n${body.message}`,
      }),
    })
    return reply.code(200).send({ id: existing[0].id, existing: true })
  }
  const inserted = await supabaseFetch<Array<{ id: string }>>('leads?select=id', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      name: body.name, email, company: body.company, notes: body.message,
      source: 'Website Contact Form', status: 'New',
    }),
  })
  return reply.code(201).send({ id: inserted[0]?.id })
})

app.get('/api/v1/online2day/crm-leads', {
  preHandler: requireSupabaseAdmin,
}, async () => supabaseFetch<Array<{
  id: string
  name: string | null
  company: string | null
  email: string | null
  status: string | null
}>>('leads?select=id,name,company,email,status&order=created_at.desc&limit=500', {
  headers: { Accept: 'application/json' },
}))

app.get('/api/v1/online2day/video-assets', {
  preHandler: requireSupabaseAdmin,
}, async (request) => {
  const query = z.object({
    leadId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(250).default(200),
  }).parse(request.query)
  const leadFilter = query.leadId ? `&lead_id=eq.${encodeURIComponent(query.leadId)}` : ''
  return supabaseFetch<VideoAssetRow[]>(
    `lead_assets?type=eq.video${leadFilter}&select=${videoAssetSelect}&order=created_at.desc&limit=${query.limit}`,
    { headers: { Accept: 'application/json' } },
  )
})

app.post('/api/v1/online2day/video-assets', {
  preHandler: requireSupabaseAdmin,
}, async (request, reply) => {
  const body = videoAssetCreateSchema.parse(request.body)
  const inserted = await supabaseFetch<VideoAssetRow[]>(`lead_assets?select=${videoAssetSelect}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      lead_id: body.leadId,
      name: body.name,
      type: 'video',
      url: body.url,
      storage_path: body.storagePath,
      public_url: body.publicUrl ?? null,
      slug: body.slug,
      metadata: body.metadata,
    }),
  })
  return reply.code(201).send(inserted[0])
})

app.patch('/api/v1/online2day/video-assets/:id', {
  preHandler: requireSupabaseAdmin,
}, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params)
  const body = videoAssetUpdateSchema.parse(request.body)
  const patch = {
    ...(body.leadId !== undefined ? { lead_id: body.leadId } : {}),
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.url !== undefined ? { url: body.url } : {}),
    ...(body.storagePath !== undefined ? { storage_path: body.storagePath || null } : {}),
    ...(body.publicUrl !== undefined ? { public_url: body.publicUrl } : {}),
    ...(body.slug !== undefined ? { slug: body.slug } : {}),
    ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
  }
  const updated = await supabaseFetch<VideoAssetRow[]>(
    `lead_assets?id=eq.${encodeURIComponent(params.id)}&type=eq.video&select=${videoAssetSelect}`,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) },
  )
  if (!updated[0]) return reply.code(404).send({ error: 'Video asset not found.' })
  return updated[0]
})

app.get('/api/v1/online2day/video-assets/:id/playback', {
  preHandler: requireSupabaseAdmin,
}, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params)
  const rows = await supabaseFetch<Array<Pick<VideoAssetRow, 'url' | 'storage_path'>>>(
    `lead_assets?id=eq.${encodeURIComponent(params.id)}&type=eq.video&select=url,storage_path&limit=1`,
    { headers: { Accept: 'application/json' } },
  )
  const asset = rows[0]
  if (!asset) return reply.code(404).send({ error: 'Video asset not found.' })
  if (!asset.storage_path) return { url: asset.url || null, expiresIn: null }
  const objectPath = asset.storage_path.split('/').map(encodeURIComponent).join('/')
  let signed: { signedURL?: string; signedUrl?: string }
  try {
    signed = await supabaseStorageFetch<{ signedURL?: string; signedUrl?: string }>(
      `object/sign/lead-videos/${objectPath}`,
      { method: 'POST', body: JSON.stringify({ expiresIn: 60 * 60 * 24 }) },
    )
  } catch (error) {
    // Historical records can outlive manually removed Storage objects. Treat a
    // missing object as unavailable media so one stale record cannot break the
    // entire video library, while preserving genuine upstream failures.
    if (error instanceof Error && /NoSuchKey|Object not found/i.test(error.message)) {
      request.log.warn({ assetId: params.id, storagePath: asset.storage_path }, 'Video storage object is missing')
      return { url: asset.url || null, expiresIn: null }
    }
    throw error
  }
  const signedPath = signed.signedURL || signed.signedUrl
  return {
    url: signedPath ? `${config.supabaseUrl}/storage/v1${signedPath}` : asset.url || null,
    expiresIn: signedPath ? 60 * 60 * 24 : null,
  }
})

app.post('/api/v1/online2day/video-assets/:id/view', {
  config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
  preHandler: requireServerKey,
}, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params)
  const rows = await supabaseFetch<Array<Pick<VideoAssetRow, 'id' | 'lead_id' | 'view_count' | 'name'>>>(
    `lead_assets?id=eq.${encodeURIComponent(params.id)}&type=eq.video&select=id,lead_id,view_count,name&limit=1`,
    { headers: { Accept: 'application/json' } },
  )
  const asset = rows[0]
  if (!asset) return reply.code(404).send({ error: 'Video asset not found.' })
  const viewCount = Math.max(0, asset.view_count || 0) + 1
  await supabaseFetch(`lead_assets?id=eq.${encodeURIComponent(params.id)}&type=eq.video`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ view_count: viewCount }),
  })
  if (asset.lead_id) {
    await supabaseFetch('lead_events', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ lead_id: asset.lead_id, type: 'Video View', note: `Viewed video “${asset.name || 'Untitled video'}”` }),
    })
  }
  return { success: true, viewCount }
})

app.delete('/api/v1/online2day/video-assets/:id', {
  preHandler: requireSupabaseAdmin,
}, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params)
  const rows = await supabaseFetch<Array<Pick<VideoAssetRow, 'storage_path' | 'metadata'>>>(
    `lead_assets?id=eq.${encodeURIComponent(params.id)}&type=eq.video&select=storage_path,metadata&limit=1`,
    { headers: { Accept: 'application/json' } },
  )
  const asset = rows[0]
  if (!asset) return reply.code(404).send({ error: 'Video asset not found.' })
  let metadata: Record<string, unknown> = {}
  try { metadata = typeof asset.metadata === 'string' ? JSON.parse(asset.metadata) : asset.metadata || {} } catch { metadata = {} }
  const paths = Array.from(new Set([asset.storage_path, metadata.originalStoragePath, metadata.thumbnailStoragePath, metadata.previewStoragePath].filter((value): value is string => typeof value === 'string' && Boolean(value))))
  for (const path of paths) {
    const shared = await supabaseFetch<Array<{ id: string }>>(`lead_assets?id=neq.${encodeURIComponent(params.id)}&storage_path=eq.${encodeURIComponent(path)}&select=id&limit=1`, { headers: { Accept: 'application/json' } })
    if (shared.length) continue
    const objectPath = path.split('/').map(encodeURIComponent).join('/')
    await supabaseStorageFetch(`object/lead-videos/${objectPath}`, { method: 'DELETE' }).catch((error) => request.log.warn({ err: error, videoAssetId: params.id, storagePath: path }, 'Video file cleanup failed'))
  }
  await supabaseFetch(`lead_assets?id=eq.${encodeURIComponent(params.id)}&type=eq.video`, {
    method: 'DELETE', headers: { Prefer: 'return=minimal' },
  })
  return reply.code(204).send()
})

app.get('/api/v1/online2day/email-templates', {
  preHandler: requireSupabaseAdmin,
}, async () => supabaseFetch<Array<Record<string, unknown>>>(
  'email_templates?select=id,name,subject,body,category,audience,stage,cta_label,sent_count,open_count,click_count,reply_count,meetings_booked,created_at,updated_at&order=updated_at.desc.nullslast,created_at.desc&limit=250',
  { headers: { Accept: 'application/json' } },
))

app.post('/api/v1/online2day/email-templates', {
  preHandler: requireSupabaseAdmin,
}, async (request, reply) => {
  const user = await requireSupabaseAdmin(request)
  const body = emailTemplateCreateSchema.parse(request.body)
  const rows = await supabaseFetch<Array<Record<string, unknown>>>(
    'email_templates?select=id,name,subject,body,category,audience,stage,cta_label,sent_count,open_count,click_count,reply_count,meetings_booked,created_at,updated_at',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        name: body.name,
        subject: body.subject,
        body: body.body,
        category: body.category,
        audience: body.audience,
        stage: body.stage,
        cta_label: body.ctaLabel,
        created_by: String(user.sub),
      }),
    },
  )
  return reply.code(201).send(rows[0])
})

app.patch('/api/v1/online2day/email-templates/:id', {
  preHandler: requireSupabaseAdmin,
}, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params)
  const body = emailTemplateUpdateSchema.parse(request.body)
  const patch = {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.subject !== undefined ? { subject: body.subject } : {}),
    ...(body.body !== undefined ? { body: body.body } : {}),
    ...(body.category !== undefined ? { category: body.category } : {}),
    ...(body.audience !== undefined ? { audience: body.audience } : {}),
    ...(body.stage !== undefined ? { stage: body.stage } : {}),
    ...(body.ctaLabel !== undefined ? { cta_label: body.ctaLabel } : {}),
    updated_at: new Date().toISOString(),
  }
  const rows = await supabaseFetch<Array<Record<string, unknown>>>(
    `email_templates?id=eq.${encodeURIComponent(params.id)}&select=id,name,subject,body,category,audience,stage,cta_label,sent_count,open_count,click_count,reply_count,meetings_booked,created_at,updated_at`,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) },
  )
  if (!rows[0]) return reply.code(404).send({ error: 'Email template not found.' })
  return rows[0]
})

app.delete('/api/v1/online2day/email-templates/:id', {
  preHandler: requireSupabaseAdmin,
}, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params)
  await supabaseFetch(`email_templates?id=eq.${encodeURIComponent(params.id)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
  return reply.code(204).send()
})

app.get('/api/v1/online2day/email-sends', {
  preHandler: requireSupabaseAdmin,
}, async (request) => {
  const query = z.object({ limit: z.coerce.number().int().min(1).max(1_000).default(50) }).parse(request.query)
  return supabaseFetch<Array<Record<string, unknown>>>(
    `emails?select=id,lead_id,template_id,subject,body,status,sent_at,opened_at,clicked_at,replied_at,created_at,lead:leads(id,name,company,email),template:email_templates(id,name)&order=sent_at.desc&limit=${query.limit}`,
    { headers: { Accept: 'application/json' } },
  )
})

app.post('/api/v1/online2day/send-email', {
  preHandler: requireSupabaseAdmin,
  config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
}, async (request, reply) => {
  const user = await requireSupabaseAdmin(request)
  const body = sendEmailSchema.parse(request.body)
  if (!config.resendApiKey) {
    return reply.code(503).send({ error: 'Email delivery is not configured in the Online2Day API.' })
  }

  let recipientName = body.recipientName
  if (body.leadId) {
    const leads = await supabaseFetch<Array<{ name: string | null }>>(
      `leads?id=eq.${encodeURIComponent(body.leadId)}&select=name&limit=1`,
      { headers: { Accept: 'application/json' } },
    )
    if (!leads[0]) return reply.code(404).send({ error: 'The selected lead is no longer available.' })
    recipientName ||= leads[0].name || undefined
  }

  const video = await resolveEmailVideo(body.videoAssetId, body.videoSlug)
  const html = renderEmailHtml({
    recipientName,
    body: body.body,
    videoUrl: video.url,
    videoTitle: video.title,
    ctaLabel: body.ctaLabel,
  })
  const plainText = `${recipientName ? `Hi ${recipientName},\n\n` : ''}${body.body}${video.url ? `\n\nWatch video: ${video.url}` : ''}`
  const sent = await requestJson<{ id: string }>('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': body.idempotencyKey,
    },
    body: JSON.stringify({
      from: config.emailFrom,
      reply_to: config.emailReplyTo,
      to: [body.to.toLowerCase()],
      subject: body.subject,
      html,
      text: plainText,
      tags: [
        { name: 'system', value: 'crm' },
        { name: 'template', value: (body.templateName || 'custom').toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 256) || 'custom' },
      ],
    }),
  })

  let warning: string | undefined
  try {
    await recordEmailSend(String(user.sub), {
      leadId: body.leadId,
      templateId: body.templateId,
      to: body.to.toLowerCase(),
      subject: body.subject,
      body: body.body,
      resendId: sent.id,
    })
  } catch (error) {
    request.log.error({ err: error, resendId: sent.id }, 'Email delivered but CRM logging failed')
    warning = 'The email was delivered, but its CRM activity record could not be saved.'
  }
  return reply.code(201).send({ success: true, id: sent.id, warning })
})

app.post('/api/v1/online2day/email-sends', {
  preHandler: requireSupabaseAdmin,
}, async (request, reply) => {
  const user = await requireSupabaseAdmin(request)
  const body = emailSendSchema.parse(request.body)
  const emailRecord = await recordEmailSend(String(user.sub), body)
  return reply.code(201).send(emailRecord)
})

app.post('/api/v1/online2day/email-events', {
  preHandler: requireServerKey,
  config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
}, async (request, reply) => {
  const body = emailEventSchema.parse(request.body)
  const pattern = encodeURIComponent(`*:${body.emailId}`)
  const records = await supabaseFetch<Array<{
    id: string
    template_id: string | null
    status: string | null
    opened_at: string | null
    clicked_at: string | null
  }>>(
    `emails?status=like.${pattern}&select=id,template_id,status,opened_at,clicked_at&limit=1`,
    { headers: { Accept: 'application/json' } },
  )
  const record = records[0]
  if (!record) return reply.code(202).send({ accepted: true, matched: false })

  const occurredAt = body.createdAt || new Date().toISOString()
  const eventState = body.eventType.replace('email.', '')
  const stateRank: Record<string, number> = {
    sent: 0, delivered: 1, delivery_delayed: 1, opened: 2, clicked: 3,
    bounced: 4, complained: 4, failed: 4, suppressed: 4,
  }
  const currentState = String(record.status || 'sent').split(':')[0] || 'sent'
  const patch: Record<string, unknown> = {}
  if ((stateRank[eventState] ?? 0) >= (stateRank[currentState] ?? 0)) {
    patch.status = `${eventState}:${body.emailId}`
  }
  const firstOpen = body.eventType === 'email.opened' && !record.opened_at
  const firstClick = body.eventType === 'email.clicked' && !record.clicked_at
  if (firstOpen) patch.opened_at = occurredAt
  if (firstClick) patch.clicked_at = occurredAt

  if (Object.keys(patch).length > 0) {
    await supabaseFetch(`emails?id=eq.${encodeURIComponent(record.id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch),
    })
  }

  if (record.template_id && (firstOpen || firstClick)) {
    const templates = await supabaseFetch<Array<{ open_count: number | null; click_count: number | null }>>(
      `email_templates?id=eq.${encodeURIComponent(record.template_id)}&select=open_count,click_count&limit=1`,
      { headers: { Accept: 'application/json' } },
    )
    const template = templates[0]
    if (template) {
      await supabaseFetch(`email_templates?id=eq.${encodeURIComponent(record.template_id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          ...(firstOpen ? { open_count: Math.max(0, template.open_count || 0) + 1 } : {}),
          ...(firstClick ? { click_count: Math.max(0, template.click_count || 0) + 1 } : {}),
          updated_at: new Date().toISOString(),
        }),
      })
    }
  }
  return { accepted: true, matched: true, eventId: body.eventId }
})

app.get('/api/v1/online2day/conversations', {
  preHandler: requireSupabaseAdmin,
}, async () => supabaseFetch<Array<Record<string, unknown>>>(
  'conversations?select=id,lead_id,contact_name,company,channel,status,priority,score,unread_count,last_message_preview,last_message_at,resolved_at,created_at,updated_at,messages(id,conversation_user_id,sender_id,content,is_read,created_at,message_type,attachment_label)&order=last_message_at.desc&limit=200',
  { headers: { Accept: 'application/json' } },
))

app.post('/api/v1/online2day/conversations/:id/reply', {
  preHandler: requireSupabaseAdmin,
}, async (request, reply) => {
  const user = await requireSupabaseAdmin(request)
  const params = z.object({ id: z.string().uuid() }).parse(request.params)
  const body = z.object({ content: z.string().trim().min(1).max(5_000) }).parse(request.body)
  const conversations = await supabaseFetch<Array<{ id: string; status: string | null }>>(
    `conversations?id=eq.${encodeURIComponent(params.id)}&select=id,status&limit=1`,
    { headers: { Accept: 'application/json' } },
  )
  if (!conversations[0]) return reply.code(404).send({ error: 'Conversation not found.' })
  const previousMessages = await supabaseFetch<Array<{ conversation_user_id: string | null }>>(
    `messages?conversation_id=eq.${encodeURIComponent(params.id)}&select=conversation_user_id&order=created_at.desc&limit=1`,
    { headers: { Accept: 'application/json' } },
  )
  const conversationUserId = previousMessages[0]?.conversation_user_id || String(user.sub)
  const now = new Date().toISOString()
  await supabaseFetch('messages', {
    method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
      conversation_id: params.id,
      conversation_user_id: conversationUserId,
      sender_id: String(user.sub),
      content: body.content,
      is_read: true,
      message_type: 'text',
    }),
  })
  await supabaseFetch(`conversations?id=eq.${encodeURIComponent(params.id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
      last_message_preview: body.content.slice(0, 120),
      last_message_at: now,
      updated_at: now,
      status: String(conversations[0].status || '').toLowerCase() === 'resolved' ? 'Open' : conversations[0].status,
    }),
  })
  return reply.code(201).send({ success: true })
})

app.post('/api/v1/online2day/conversations/:id/read', {
  preHandler: requireSupabaseAdmin,
}, async (request) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params)
  const now = new Date().toISOString()
  await Promise.all([
    supabaseFetch(`messages?conversation_id=eq.${encodeURIComponent(params.id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ is_read: true }),
    }),
    supabaseFetch(`conversations?id=eq.${encodeURIComponent(params.id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ unread_count: 0, updated_at: now }),
    }),
  ])
  return { success: true }
})

app.get('/api/v1/online2day/site-requests', {
  preHandler: requireSupabaseAdmin,
}, async () => supabaseFetch<Array<Record<string, unknown>>>(
  'site_requests?select=id,title,company,type,priority,stage,contact_name,contact_email,description,budget_min,budget_max,timeline_weeks,brief_url,next_action,lead_id,created_at,updated_at&order=created_at.desc&limit=250',
  { headers: { Accept: 'application/json' } },
))

app.patch('/api/v1/online2day/site-requests/:id', {
  preHandler: requireSupabaseAdmin,
}, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params)
  const body = siteRequestUpdateSchema.parse(request.body)
  const rows = await supabaseFetch<Array<Record<string, unknown>>>(
    `site_requests?id=eq.${encodeURIComponent(params.id)}&select=*`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        ...(body.stage !== undefined ? { stage: body.stage } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.nextAction !== undefined ? { next_action: body.nextAction } : {}),
        updated_at: new Date().toISOString(),
      }),
    },
  )
  if (!rows[0]) return reply.code(404).send({ error: 'Site request not found.' })
  return rows[0]
})

app.get('/api/v1/online2day/dashboard-support', {
  preHandler: requireSupabaseAdmin,
}, async (request) => {
  const query = z.object({ section: z.string().trim().max(80).optional() }).parse(request.query)
  const snapshotFilter = query.section ? `&section=eq.${encodeURIComponent(query.section)}` : ''
  const [snapshots, integrations, goals, healthChecks] = await Promise.all([
    supabaseFetch<Array<Record<string, unknown>>>(
      `metric_snapshots?select=section,metric_label,value_numeric,snapshot_date${snapshotFilter}&order=snapshot_date.asc&limit=1000`,
      { headers: { Accept: 'application/json' } },
    ),
    supabaseFetch<Array<Record<string, unknown>>>(
      'integrations?select=id,name,type,status,last_synced_at,updated_at&order=name.asc&limit=100',
      { headers: { Accept: 'application/json' } },
    ),
    supabaseFetch<Array<Record<string, unknown>>>(
      'goals?select=id,label,target_value,current_value,unit,period_start,period_end,created_at,updated_at&order=created_at.asc&limit=100',
      { headers: { Accept: 'application/json' } },
    ),
    supabaseFetch<Array<Record<string, unknown>>>(
      'integration_health_checks?select=provider,status,latency_ms,checked_at,detail&order=checked_at.desc&limit=12',
      { headers: { Accept: 'application/json' } },
    ).catch(() => []),
  ])
  return {
    snapshots,
    integrations,
    goals,
    healthChecks,
    capabilities: { resend: Boolean(config.resendApiKey) },
  }
})

app.post('/api/v1/online2day/integration-health-checks', {
  preHandler: requireSupabaseAdmin,
}, async (request, reply) => {
  const body = z.object({ checks: z.array(z.object({
    provider: z.string().trim().min(1).max(80),
    status: z.enum(['healthy', 'degraded', 'down', 'unknown']),
    latencyMs: z.number().int().min(0).max(120_000).nullable(),
    checkedAt: z.string().datetime(),
    detail: z.string().trim().max(1_000),
  })).min(1).max(12) }).parse(request.body)
  try {
    await supabaseFetch('integration_health_checks', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(body.checks.map((check) => ({
        provider: check.provider,
        status: check.status,
        latency_ms: check.latencyMs,
        checked_at: check.checkedAt,
        detail: check.detail,
      }))),
    })
    return reply.code(201).send({ success: true, persisted: 'history' })
  } catch (error) {
    if (!(error instanceof Error) || !/integration_health_checks|PGRST205/i.test(error.message)) throw error
    // Older projects have the durable integrations table but not the optional
    // append-only history table. Keep their current status accurate instead of
    // turning a successful provider check into a dashboard error.
    await Promise.all(body.checks.map((check) => supabaseFetch(
      `integrations?name=ilike.${encodeURIComponent(check.provider)}`,
      { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: check.status, last_synced_at: check.checkedAt, updated_at: check.checkedAt }) },
    )))
    request.log.warn('Integration health history table is unavailable; current integration status was updated instead')
    return reply.code(201).send({ success: true, persisted: 'current-status' })
  }
})

app.route({
  method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  url: '/*',
  handler: async (request, reply) => {
  const target = new URL(request.raw.url || '/', config.coreApiUrl)
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    if (!value || ['host', 'content-length', 'connection'].includes(name.toLowerCase())) continue
    headers.set(name, Array.isArray(value) ? value.join(',') : value)
  }
  const hasBody = !['GET', 'HEAD'].includes(request.method)
  const upstream = await fetch(target, {
    method: request.method, headers,
    body: hasBody && request.body !== undefined ? JSON.stringify(request.body) : undefined,
    signal: AbortSignal.timeout(15_000), redirect: 'manual',
  })
  const responseHeaders: Record<string, string> = {}
  upstream.headers.forEach((value, name) => {
    if (!['connection', 'content-length', 'transfer-encoding'].includes(name.toLowerCase())) responseHeaders[name] = value
  })
    return reply.code(upstream.status).headers(responseHeaders).send(Buffer.from(await upstream.arrayBuffer()))
  },
})

app.setErrorHandler((error, request, reply) => {
  const knownError = error instanceof Error ? error : new Error('Unknown error')
  const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === 'number'
    ? (error as { statusCode: number }).statusCode
    : undefined
  const status = statusCode ?? (error instanceof z.ZodError ? 400 : 500)
  if (status >= 500) request.log.error({ err: error }, 'Request failed')
  reply.code(status).send({
    error: status >= 500 ? 'The integration service is temporarily unavailable.' : knownError.message,
  })
})

await app.listen({ port: config.port, host: '0.0.0.0' })
