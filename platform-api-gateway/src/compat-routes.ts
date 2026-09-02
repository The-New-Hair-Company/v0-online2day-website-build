import type { FastifyInstance, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import sanitizeHtml from 'sanitize-html'

type SupabaseRequest = <T>(path: string, init?: RequestInit) => Promise<T>
type CompatRouteDeps = {
  requireAdmin: (request: FastifyRequest) => Promise<Record<string, unknown>>
  supabaseFetch: SupabaseRequest
  supabaseStorageFetch?: SupabaseRequest
  supabaseUrl?: string
}

const uuid = z.string().uuid()
const key = z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9_.:-]+$/)
const value = z.string().max(1_000_000)
const now = () => new Date().toISOString()
const foundingAdmins = new Set(['oliverjosephking@gmail.com', 'info@online2day.com'])

function createdRow<T>(rows: T[], resource: string): T {
  const row = rows[0]
  if (!row) throw Object.assign(new Error(`${resource} could not be persisted.`), { statusCode: 502 })
  return row
}

type LeadRow = Record<string, unknown> & { id: string; name: string; created_at: string; updated_at: string }
type BlogRow = Record<string, unknown> & { id: string; slug: string; title: string; created_at: string }
type LicensedUserRow = {
  id: string
  email: string
  fullName: string | null
  role: 'admin' | 'member' | 'viewer'
  status: 'active' | 'pending' | 'suspended' | 'revoked'
  seatType: 'admin' | 'standard' | 'viewer'
  invitedBy: string | null
  lastSeenAt: string | null
  createdAt: string
  updatedAt: string | null
}

const licensedUserInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
  fullName: z.string().trim().max(200).nullable().optional(),
  seatType: z.enum(['admin', 'standard', 'viewer']).nullable().optional(),
})
function seatType(role: LicensedUserRow['role']): LicensedUserRow['seatType'] {
  if (role === 'admin') return 'admin'
  if (role === 'viewer') return 'viewer'
  return 'standard'
}

function leadDto(row: LeadRow) {
  return {
    id: row.id, name: row.name, email: row.email ?? row.email_address ?? null,
    phone: row.phone ?? row.phone_number ?? null, company: row.company ?? null,
    website: row.website ?? null, status: row.status ?? 'New', source: row.source ?? null,
    notes: row.notes ?? null, assignedTo: row.assigned_to ?? null,
    followUpDate: row.follow_up_date ?? null, lastContactedAt: row.last_contacted_at ?? null,
    closedAt: row.closed_at ?? null, score: row.score ?? null, engagement: row.engagement ?? null,
    value: row.value ?? null, role: row.role ?? null, linkedInUrl: row.linkedin_url ?? null,
    nextAction: row.next_action ?? null, lostReason: row.lost_reason ?? null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

function blogDto(row: BlogRow) {
  return {
    id: row.id, slug: row.slug, title: row.title, excerpt: row.excerpt ?? null,
    content: row.content ?? null, category: row.category ?? null, coverUrl: row.cover_url ?? null,
    authorName: row.author_name ?? 'Online2Day Team', authorRole: row.author_role ?? 'Online2Day',
    tags: Array.isArray(row.tags) ? row.tags : [], readTime: row.read_time ?? null,
    isPublished: Boolean(row.published), publishedAt: row.published_at ?? null,
    publishStatus: row.publish_status ?? (row.published ? 'published' : 'draft'),
    scheduledAt: row.scheduled_at ?? null, archivedAt: row.archived_at ?? null,
    canonicalUrl: row.canonical_url ?? null, focusKeyword: row.focus_keyword ?? null,
    ogImageUrl: row.og_image_url ?? null, coverAltText: row.cover_alt_text ?? null,
    ogTitle: row.og_title ?? null, ogDescription: row.og_description ?? null,
    noindex: Boolean(row.noindex),
    seoTitle: row.seo_title ?? null, seoDesc: row.seo_desc ?? null,
    createdAt: row.created_at, updatedAt: row.updated_at ?? null,
  }
}

function taskDto(row: Record<string, unknown>) {
  return {
    id: row.id,
    leadId: row.lead_id,
    title: row.title,
    description: null,
    dueDate: row.due_at ?? null,
    assignedTo: row.assigned_to ?? null,
    completedAt: null,
    isCompleted: Boolean(row.is_done),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  }
}

function activityDto(row: Record<string, unknown>) {
  return {
    id: row.id,
    actorName: row.actor_name,
    type: row.type,
    entityType: row.entity_type ?? null,
    entityId: row.entity_id ?? null,
    entityName: row.entity_name ?? null,
    description: row.description ?? null,
    createdAt: row.created_at,
  }
}

const leadWrite = z.object({
  name: z.string().trim().min(1).max(200), email: z.string().trim().email().max(254).nullable().optional(),
  phone: z.string().trim().max(80).nullable().optional(), company: z.string().trim().max(240).nullable().optional(),
  website: z.string().trim().max(500).nullable().optional(), source: z.string().trim().max(160).nullable().optional(),
  notes: z.string().max(50_000).nullable().optional(), role: z.string().trim().max(160).nullable().optional(),
  linkedInUrl: z.string().trim().max(500).nullable().optional(), followUpDate: z.string().datetime().nullable().optional(),
  value: z.number().finite().nullable().optional(), nextAction: z.string().max(2_000).nullable().optional(),
  assignedTo: z.string().max(200).nullable().optional(), status: z.string().trim().max(100).optional(),
})

function leadPayload(body: z.infer<typeof leadWrite>, partial = false) {
  return {
    name: body.name,
    ...(body.email !== undefined ? { email: body.email, email_address: body.email } : {}),
    ...(body.phone !== undefined ? { phone: body.phone, phone_number: body.phone } : {}),
    ...(body.company !== undefined ? { company: body.company } : {}),
    ...(body.website !== undefined ? { website: body.website } : {}),
    ...(body.source !== undefined ? { source: body.source } : {}),
    ...(body.notes !== undefined ? { notes: body.notes } : {}),
    ...(body.role !== undefined ? { role: body.role } : {}),
    ...(body.linkedInUrl !== undefined ? { linkedin_url: body.linkedInUrl } : {}),
    ...(body.followUpDate !== undefined ? { follow_up_date: body.followUpDate } : {}),
    ...(body.value !== undefined ? { value: body.value } : {}),
    ...(body.nextAction !== undefined ? { next_action: body.nextAction } : {}),
    ...(body.assignedTo !== undefined ? { assigned_to: body.assignedTo } : {}),
    ...(body.status !== undefined || !partial ? { status: body.status || 'New' } : {}),
    updated_at: now(),
  }
}

const blogWrite = z.object({
  slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(240), excerpt: z.string().max(2_000).nullable().optional(),
  content: z.string().max(1_000_000).nullable().optional(), category: z.string().max(120).nullable().optional(),
  coverUrl: z.string().url().max(2_000).nullable().optional(), authorName: z.string().max(160).nullable().optional(),
  authorRole: z.string().max(160).nullable().optional(), tags: z.array(z.string().trim().max(80)).max(30).optional(),
  readTime: z.number().int().min(1).max(240).nullable().optional(), seoTitle: z.string().max(240).nullable().optional(),
  seoDesc: z.string().max(500).nullable().optional(),
  canonicalUrl: z.string().url().max(2_000).nullable().optional(),
  focusKeyword: z.string().trim().max(160).nullable().optional(),
  ogImageUrl: z.string().url().max(2_000).nullable().optional(),
  coverAltText: z.string().trim().max(500).nullable().optional(),
  ogTitle: z.string().trim().max(240).nullable().optional(),
  ogDescription: z.string().trim().max(500).nullable().optional(),
  noindex: z.boolean().optional(),
})

const blogHtmlOptions: sanitizeHtml.IOptions = {
  allowedTags: ['p','br','h2','h3','h4','strong','em','u','s','blockquote','pre','code','ul','ol','li','a','hr','img','table','thead','tbody','tr','th','td','div','iframe'],
  allowedAttributes: {
    a: ['href','target','rel'],
    img: ['src','alt','title','class','width','height'],
    table: ['class'],
    th: ['colspan','rowspan'], td: ['colspan','rowspan'],
    div: ['data-youtube-video'],
    iframe: ['src','width','height','allowfullscreen','title','loading','referrerpolicy','frameborder','allow'],
    '*': ['style'],
  },
  allowedStyles: { '*': { 'text-align': [/^left$/, /^center$/, /^right$/] } },
  allowedSchemes: ['http','https','mailto'],
  allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com'],
  transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }) },
}

function blogPayload(body: z.infer<typeof blogWrite>) {
  return { slug: body.slug, title: body.title, excerpt: body.excerpt ?? null,
    content: body.content ? sanitizeHtml(body.content, blogHtmlOptions) : null,
    category: body.category ?? null, cover_url: body.coverUrl ?? null, author_name: body.authorName || 'Online2Day Team',
    author_role: body.authorRole || 'Online2Day', tags: body.tags || [], read_time: body.readTime ?? null,
    seo_title: body.seoTitle ?? null, seo_desc: body.seoDesc ?? null,
    canonical_url: body.canonicalUrl ?? null, focus_keyword: body.focusKeyword ?? null,
    og_image_url: body.ogImageUrl ?? null, cover_alt_text: body.coverAltText ?? null,
    og_title: body.ogTitle ?? null, og_description: body.ogDescription ?? null,
    noindex: body.noindex ?? false, updated_at: now() }
}

export function registerCompatRoutes(app: FastifyInstance, deps: CompatRouteDeps) {
  async function readLicensedUsers(): Promise<LicensedUserRow[]> {
    const rows = await deps.supabaseFetch<Array<Record<string, unknown>>>('licensed_users?select=id,email,full_name,role,status,seat_type,last_seen_at,created_at,updated_at&order=created_at.asc&limit=500')
    return rows.flatMap((item) => {
      const parsed = licensedUserInput.safeParse({ email: item.email, role: item.role, fullName: item.full_name, seatType: item.seat_type })
      if (!parsed.success || typeof item.id !== 'string' || !uuid.safeParse(item.id).success) return []
      const role = foundingAdmins.has(parsed.data.email) ? 'admin' : parsed.data.role
      return [{
        id: item.id,
        email: parsed.data.email,
        fullName: parsed.data.fullName ?? null,
        role,
        status: item.status === 'pending' || item.status === 'suspended' || item.status === 'revoked' ? item.status : 'active',
        seatType: seatType(role),
        invitedBy: null,
        lastSeenAt: typeof item.last_seen_at === 'string' ? item.last_seen_at : null,
        createdAt: typeof item.created_at === 'string' ? item.created_at : now(),
        updatedAt: typeof item.updated_at === 'string' ? item.updated_at : null,
      }]
    })
  }

  async function writeLicensedUser(user: LicensedUserRow) {
    await deps.supabaseFetch('licensed_users?on_conflict=email', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: user.id, email: user.email, full_name: user.fullName, role: user.role, status: user.status, seat_type: user.seatType, last_seen_at: user.lastSeenAt, created_at: user.createdAt, updated_at: user.updatedAt || now() }),
    })
  }

  app.get('/api/v1/leads', { preHandler: deps.requireAdmin }, async (request) => {
    const query = z.object({ search: z.string().max(200).optional(), status: z.string().max(100).optional() }).parse(request.query)
    const rows = await deps.supabaseFetch<LeadRow[]>('leads?select=*&order=created_at.desc&limit=1000', { headers: { Accept: 'application/json' } })
    const search = query.search?.trim().toLowerCase()
    return rows.filter((row) => (!query.status || String(row.status || '') === query.status) && (!search || [row.name,row.email,row.email_address,row.company,row.phone,row.phone_number].some((field) => String(field || '').toLowerCase().includes(search)))).map(leadDto)
  })
  app.get('/api/v1/leads/:id', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const { id } = z.object({ id: uuid }).parse(request.params); const rows = await deps.supabaseFetch<LeadRow[]>(`leads?id=eq.${id}&select=*&limit=1`)
    return rows[0] ? leadDto(rows[0]) : reply.code(404).send({ error: 'Lead not found.' })
  })
  app.post('/api/v1/leads', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const body = leadWrite.parse(request.body); const rows = await deps.supabaseFetch<LeadRow[]>('leads?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(leadPayload(body)) })
    return reply.code(201).send(leadDto(createdRow(rows, 'Lead')))
  })
  app.put('/api/v1/leads/:id', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const { id } = z.object({ id: uuid }).parse(request.params); const body = leadWrite.parse(request.body)
    const rows = await deps.supabaseFetch<LeadRow[]>(`leads?id=eq.${id}&select=*`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(leadPayload(body, true)) })
    return rows[0] ? leadDto(rows[0]) : reply.code(404).send({ error: 'Lead not found.' })
  })
  app.patch('/api/v1/leads/:id/status', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const { id } = z.object({ id: uuid }).parse(request.params); const body = z.object({ status: z.string().trim().min(1).max(100) }).parse(request.body)
    await deps.supabaseFetch(`leads?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: body.status, updated_at: now() }) }); return reply.code(204).send()
  })
  app.post('/api/v1/leads/:id/notes', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const { id } = z.object({ id: uuid }).parse(request.params); const { note } = z.object({ note: z.string().trim().min(1).max(20_000) }).parse(request.body)
    const rows = await deps.supabaseFetch<Array<{ notes: string | null }>>(`leads?id=eq.${id}&select=notes&limit=1`); if (!rows[0]) return reply.code(404).send({ error: 'Lead not found.' })
    await deps.supabaseFetch(`leads?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ notes: [rows[0].notes, note].filter(Boolean).join('\n\n'), updated_at: now() }) }); return reply.code(204).send()
  })
  app.delete('/api/v1/leads/:id', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const { id } = z.object({ id: uuid }).parse(request.params); await deps.supabaseFetch(`leads?id=eq.${id}`, { method: 'DELETE' }); return reply.code(204).send()
  })
  app.get('/api/v1/leads/:id/events', { preHandler: deps.requireAdmin }, async (request) => {
    const { id } = z.object({ id: uuid }).parse(request.params); const rows = await deps.supabaseFetch<Array<Record<string, unknown>>>(`lead_events?lead_id=eq.${id}&select=*&order=created_at.desc&limit=500`)
    return rows.map((row) => ({ id: row.id, leadId: row.lead_id, type: row.type, title: row.title ?? null, note: row.note ?? null, metadata: typeof row.metadata === 'string' ? row.metadata : JSON.stringify(row.metadata ?? null), createdBy: row.created_by ?? null, createdAt: row.created_at }))
  })
  app.post('/api/v1/leads/:id/events', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const { id } = z.object({ id: uuid }).parse(request.params)
    const body = z.object({ type: z.string().trim().min(1).max(120), note: z.string().max(20_000).nullable().optional(), metadata: z.string().max(100_000).nullable().optional() }).parse(request.body)
    await deps.supabaseFetch('lead_events', { method: 'POST', body: JSON.stringify({ lead_id: id, type: body.type, note: body.note ?? null, metadata: body.metadata ? JSON.parse(body.metadata) : null, created_by: String(user.sub) }) }); return reply.code(201).send()
  })

  app.get('/api/v1/tasks/upcoming', { preHandler: deps.requireAdmin }, async (request) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(request.query)
    const rows = await deps.supabaseFetch<Array<Record<string, unknown>>>(
      `lead_tasks?is_done=eq.false&select=*&order=due_at.asc.nullslast,created_at.desc&limit=${limit}`,
    )
    return rows.map(taskDto)
  })

  app.get('/api/v1/leads/:id/tasks', { preHandler: deps.requireAdmin }, async (request) => {
    const { id } = z.object({ id: uuid }).parse(request.params)
    const rows = await deps.supabaseFetch<Array<Record<string, unknown>>>(
      `lead_tasks?lead_id=eq.${id}&select=*&order=is_done.asc,due_at.asc.nullslast,created_at.desc&limit=500`,
    )
    return rows.map(taskDto)
  })

  app.post('/api/v1/leads/:id/tasks', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const actor = await deps.requireAdmin(request)
    const { id } = z.object({ id: uuid }).parse(request.params)
    const body = z.object({
      title: z.string().trim().min(1).max(500),
      description: z.string().max(10_000).nullable().optional(),
      dueDate: z.string().datetime().nullable().optional(),
      assignedTo: uuid.nullable().optional(),
    }).parse(request.body)
    const rows = await deps.supabaseFetch<Array<Record<string, unknown>>>('lead_tasks?select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        lead_id: id,
        title: body.title,
        due_at: body.dueDate ?? null,
        assigned_to: body.assignedTo ?? String(actor.sub),
        is_done: false,
      }),
    })
    return reply.code(201).send(taskDto(createdRow(rows, 'Lead task')))
  })

  app.post('/api/v1/leads/:leadId/tasks/:taskId/complete', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const { leadId, taskId } = z.object({ leadId: uuid, taskId: uuid }).parse(request.params)
    await deps.supabaseFetch(`lead_tasks?id=eq.${taskId}&lead_id=eq.${leadId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ is_done: true, updated_at: now() }),
    })
    return reply.code(204).send()
  })

  app.post('/api/v1/leads/:leadId/tasks/:taskId/uncomplete', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const { leadId, taskId } = z.object({ leadId: uuid, taskId: uuid }).parse(request.params)
    await deps.supabaseFetch(`lead_tasks?id=eq.${taskId}&lead_id=eq.${leadId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ is_done: false, updated_at: now() }),
    })
    return reply.code(204).send()
  })

  app.get('/api/v1/activity-feed', { preHandler: deps.requireAdmin }, async (request) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(request.query)
    const rows = await deps.supabaseFetch<Array<Record<string, unknown>>>(
      `activity_feed?select=*&order=created_at.desc&limit=${limit}`,
    )
    return rows.map(activityDto)
  })

  app.post('/api/v1/activity-feed', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const body = z.object({
      actorName: z.string().trim().min(1).max(200),
      type: z.string().trim().min(1).max(120),
      entityType: z.string().trim().max(120).nullable().optional(),
      entityId: uuid.nullable().optional(),
      entityName: z.string().trim().max(240).nullable().optional(),
      description: z.string().max(10_000).nullable().optional(),
    }).parse(request.body)
    await deps.supabaseFetch('activity_feed', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        actor_name: body.actorName,
        type: body.type,
        entity_type: body.entityType ?? null,
        entity_id: body.entityId ?? null,
        entity_name: body.entityName ?? null,
        description: body.description ?? null,
      }),
    })
    return reply.code(201).send()
  })

  app.get('/api/v1/enterprise/state/:key', { preHandler: deps.requireAdmin }, async (request) => {
    const params = z.object({ key }).parse(request.params)
    const rows = await deps.supabaseFetch<Array<Record<string, unknown>>>(`enterprise_state?key=eq.${encodeURIComponent(params.key)}&select=*&limit=1`)
    const row = rows[0]; return row ? { id: row.id, key: row.key, value: typeof row.value === 'string' ? row.value : JSON.stringify(row.value ?? null), createdAt: row.updated_at, updatedAt: row.updated_at } : null
  })
  app.put('/api/v1/enterprise/state/:key', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const params = z.object({ key }).parse(request.params); const body = z.object({ value }).parse(request.body); let parsed: unknown
    try { parsed = JSON.parse(body.value) } catch { parsed = body.value }
    await deps.supabaseFetch('enterprise_state?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: params.key, value: parsed, updated_at: now() }) }); return reply.code(204).send()
  })
  app.get('/api/v1/enterprise/events', { preHandler: deps.requireAdmin }, async (request) => {
    const rows = await deps.supabaseFetch<Array<Record<string, unknown>>>('enterprise_events?select=*&order=event_time.asc&limit=500')
    return rows.map((row) => ({ id: row.id, title: row.title, eventTime: row.event_time, eventType: row.event_type, createdAt: row.created_at }))
  })
  app.post('/api/v1/enterprise/events', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const body = z.object({ title: z.string().trim().min(1).max(240), eventTime: z.string().datetime(), eventType: z.string().max(80) }).parse(request.body)
    const rows = await deps.supabaseFetch<Array<Record<string, unknown>>>('enterprise_events?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ title: body.title, event_time: body.eventTime, event_type: body.eventType, updated_at: now() }) }); const row = createdRow(rows, 'Enterprise event')
    return reply.code(201).send({ id: row.id, title: row.title, eventTime: row.event_time, eventType: row.event_type, createdAt: row.created_at })
  })
  app.delete('/api/v1/enterprise/events/:id', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const { id } = z.object({ id: uuid }).parse(request.params); await deps.supabaseFetch(`enterprise_events?id=eq.${id}`, { method: 'DELETE' }); return reply.code(204).send()
  })
  app.get('/api/v1/enterprise/tasks', { preHandler: deps.requireAdmin }, async (request) => {
    const rows = await deps.supabaseFetch<Array<Record<string, unknown>>>('enterprise_tasks?select=*&order=created_at.desc&limit=500')
    return rows.map((row) => ({ id: row.id, title: row.title, isDone: row.is_done, completedAt: null, createdAt: row.created_at }))
  })
  app.post('/api/v1/enterprise/tasks', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const body = z.object({ title: z.string().trim().min(1).max(500) }).parse(request.body)
    const rows = await deps.supabaseFetch<Array<Record<string, unknown>>>('enterprise_tasks?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ title: body.title }) }); const row = createdRow(rows, 'Enterprise task')
    return reply.code(201).send({ id: row.id, title: row.title, isDone: row.is_done, completedAt: null, createdAt: row.created_at })
  })
  app.patch('/api/v1/enterprise/tasks/:id/toggle', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const { id } = z.object({ id: uuid }).parse(request.params); const body = z.object({ isDone: z.boolean() }).parse(request.body)
    await deps.supabaseFetch(`enterprise_tasks?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ is_done: body.isDone, updated_at: now() }) }); return reply.code(204).send()
  })

  app.get('/api/v1/admin/licensed-users', { preHandler: deps.requireAdmin }, async () => readLicensedUsers())
  app.post('/api/v1/admin/licensed-users', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const actor = await deps.requireAdmin(request)
    const body = licensedUserInput.parse(request.body)
    const users = await readLicensedUsers()
    const current = users.find((user) => user.email === body.email)
    const role = foundingAdmins.has(body.email) ? 'admin' : body.role
    const timestamp = now()
    const next: LicensedUserRow = {
      id: current?.id ?? randomUUID(),
      email: body.email,
      fullName: body.fullName ?? current?.fullName ?? null,
      role,
      status: 'active',
      seatType: seatType(role),
      invitedBy: current?.invitedBy ?? (typeof actor.email === 'string' ? actor.email : String(actor.sub)),
      lastSeenAt: current?.lastSeenAt ?? null,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: current ? timestamp : null,
    }
    await writeLicensedUser(next)
    return reply.code(current ? 200 : 201).send(next)
  })
  app.patch('/api/v1/admin/licensed-users/:email/role', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const email = z.string().trim().toLowerCase().email().max(254).parse((request.params as { email: string }).email)
    if (foundingAdmins.has(email)) return reply.code(403).send({ error: 'Protected admin accounts cannot be downgraded.' })
    const { role } = z.object({ role: z.enum(['admin', 'member', 'viewer']) }).parse(request.body)
    const users = await readLicensedUsers(); const current = users.find((user) => user.email === email)
    if (!current) return reply.code(404).send({ error: 'Licensed user not found.' })
    await writeLicensedUser({ ...current, role, seatType: seatType(role), updatedAt: now() })
    return reply.code(204).send()
  })
  app.delete('/api/v1/admin/licensed-users/:email', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const email = z.string().trim().toLowerCase().email().max(254).parse((request.params as { email: string }).email)
    if (foundingAdmins.has(email)) return reply.code(403).send({ error: 'Protected admin accounts cannot be removed.' })
    const users = await readLicensedUsers()
    if (!users.some((user) => user.email === email)) return reply.code(404).send({ error: 'Licensed user not found.' })
    await deps.supabaseFetch(`licensed_users?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' }); return reply.code(204).send()
  })

  app.get('/api/v1/admin/preferences', { preHandler: deps.requireAdmin }, async (request) => {
    const user = await deps.requireAdmin(request); const query = z.object({ keys: z.string().max(5_000).default('') }).parse(request.query); const keys = query.keys.split(',').map((item) => item.trim()).filter(Boolean).map((item) => key.parse(item)); if (!keys.length) return []
    const rows = await deps.supabaseFetch<Array<{ key: string; value: string }>>(`admin_preferences?user_id=eq.${encodeURIComponent(String(user.sub))}&key=in.(${keys.map(encodeURIComponent).join(',')})&select=key,value`); return rows
  })
  app.get('/api/v1/admin/preferences/:key', { preHandler: deps.requireAdmin }, async (request) => {
    const user = await deps.requireAdmin(request); const params = z.object({ key }).parse(request.params); const rows = await deps.supabaseFetch<Array<{ key: string; value: string }>>(`admin_preferences?user_id=eq.${encodeURIComponent(String(user.sub))}&key=eq.${encodeURIComponent(params.key)}&select=key,value&limit=1`); return rows[0] || null
  })
  app.put('/api/v1/admin/preferences/batch', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const body = z.object({ prefs: z.record(key, value).refine((item) => Object.keys(item).length <= 100) }).parse(request.body)
    const rows = Object.entries(body.prefs).map(([prefKey, prefValue]) => ({ user_id: String(user.sub), key: prefKey, value: prefValue, updated_at: now() })); if (rows.length) await deps.supabaseFetch('admin_preferences?on_conflict=user_id,key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) }); return reply.code(204).send()
  })
  app.put('/api/v1/admin/preferences/:key', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const params = z.object({ key }).parse(request.params); const body = z.object({ value }).parse(request.body)
    await deps.supabaseFetch('admin_preferences?on_conflict=user_id,key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: String(user.sub), key: params.key, value: body.value, updated_at: now() }) }); return reply.code(204).send()
  })
  app.get('/api/v1/admin/audit-log', { preHandler: deps.requireAdmin }, async (request) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(request.query)
    const rows = await deps.supabaseFetch<Array<Record<string, unknown>>>(`lead_audit_log?select=*&order=created_at.desc&limit=${limit}`)
    return rows.map((row) => ({ id: row.id, userId: row.actor_user_id ?? null, actorEmail: row.actor_email ?? null, action: row.action, resource: row.field_changed ?? 'system', resourceId: row.lead_id ?? null, changes: row.new_value ?? null, createdAt: row.created_at }))
  })
  app.post('/api/v1/admin/audit-log', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const body = z.object({ action: z.string().trim().min(1).max(160), resource: z.string().trim().min(1).max(160), resourceId: z.string().max(500).nullable().optional(), changes: z.string().max(100_000).nullable().optional() }).parse(request.body)
    await deps.supabaseFetch('lead_audit_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ action: body.action, actor_user_id: String(user.sub), actor_email: typeof user.email === 'string' ? user.email : null, lead_id: body.resourceId && uuid.safeParse(body.resourceId).success ? body.resourceId : null, field_changed: body.resource, old_value: null, new_value: body.changes ?? body.resourceId ?? null }) }); return reply.code(204).send()
  })

  app.get('/api/v1/reports/snapshots', { preHandler: deps.requireAdmin }, async (request) => {
    const user = await deps.requireAdmin(request); const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(request.query)
    const rows = await deps.supabaseFetch<Array<Record<string, unknown>>>(`report_snapshots?user_id=eq.${encodeURIComponent(String(user.sub))}&select=*&order=created_at.desc&limit=${limit}`); return rows.map((row) => ({ id: row.id, type: row.period_label, data: JSON.stringify(row.kpis ?? {}), capturedBy: row.created_by ?? row.user_id, createdAt: row.created_at }))
  })
  app.post('/api/v1/reports/snapshots', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const body = z.object({ type: z.string().trim().min(1).max(120), data: value }).parse(request.body)
    let kpis: unknown; try { kpis = JSON.parse(body.data) } catch { throw Object.assign(new Error('Report data must be valid JSON.'), { statusCode: 400 }) }
    const rows = await deps.supabaseFetch<Array<Record<string, unknown>>>('report_snapshots?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ user_id: String(user.sub), period_label: body.type, kpis, created_by: String(user.sub) }) }); const row = createdRow(rows, 'Report snapshot'); return reply.code(201).send({ id: row.id, type: row.period_label, data: JSON.stringify(row.kpis ?? {}), capturedBy: row.created_by ?? row.user_id, createdAt: row.created_at })
  })

  app.get('/api/v1/blog', async () => (await deps.supabaseFetch<BlogRow[]>(`blog_posts?published=eq.true&published_at=lte.${encodeURIComponent(now())}&select=*&order=published_at.desc.nullslast,created_at.desc&limit=100`)).map(blogDto))
  app.get('/api/v1/blog/:slug', async (request, reply) => {
    const slug = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).parse((request.params as { slug: string }).slug)
    const rows = await deps.supabaseFetch<BlogRow[]>(`blog_posts?slug=eq.${encodeURIComponent(slug)}&published=eq.true&published_at=lte.${encodeURIComponent(now())}&select=*&limit=1`)
    if (rows[0]) return blogDto(rows[0])
    const redirects = await deps.supabaseFetch<Array<{ post_id: string }>>(`blog_slug_redirects?old_slug=eq.${encodeURIComponent(slug)}&select=post_id&limit=1`)
    if (!redirects[0]) return reply.code(404).send({ error: 'Post not found.' })
    const redirected = await deps.supabaseFetch<BlogRow[]>(`blog_posts?id=eq.${redirects[0].post_id}&published=eq.true&published_at=lte.${encodeURIComponent(now())}&select=*&limit=1`)
    return redirected[0] ? blogDto(redirected[0]) : reply.code(404).send({ error: 'Post not found.' })
  })
  app.get('/api/v1/admin/blog', { preHandler: deps.requireAdmin }, async () => (await deps.supabaseFetch<BlogRow[]>('blog_posts?select=*&order=created_at.desc&limit=500')).map(blogDto))
  app.get('/api/v1/admin/blog/:id', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const { id } = z.object({ id: uuid }).parse(request.params); const rows = await deps.supabaseFetch<BlogRow[]>(`blog_posts?id=eq.${id}&select=*&limit=1`); return rows[0] ? blogDto(rows[0]) : reply.code(404).send({ error: 'Post not found.' })
  })
  app.post('/api/v1/admin/blog', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const body = blogWrite.parse(request.body); const rows = await deps.supabaseFetch<BlogRow[]>('blog_posts?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...blogPayload(body), published: false, publish_status: 'draft', updated_by: String(user.sub) }) }); return reply.code(201).send(blogDto(createdRow(rows, 'Blog post')))
  })
  app.put('/api/v1/admin/blog/:id', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request); const { id } = z.object({ id: uuid }).parse(request.params); const body = blogWrite.parse(request.body); const rows = await deps.supabaseFetch<BlogRow[]>(`blog_posts?id=eq.${id}&select=*`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...blogPayload(body), updated_by: String(user.sub) }) }); if (!rows[0]) return reply.code(404).send({ error: 'Post not found.' }); return reply.code(204).send()
  })
  app.patch('/api/v1/admin/blog/:id/publish', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const { id } = z.object({ id: uuid }).parse(request.params); const { publish } = z.object({ publish: z.boolean() }).parse(request.body)
    if (publish) {
      const posts = await deps.supabaseFetch<Array<{ cover_url?: string | null; cover_alt_text?: string | null }>>(`blog_posts?id=eq.${id}&select=cover_url,cover_alt_text&limit=1`)
      if (!posts[0]) return reply.code(404).send({ error: 'Post not found.' })
      if (posts[0].cover_url && !posts[0].cover_alt_text?.trim()) return reply.code(400).send({ error: 'Cover image alt text is required before publishing.' })
    }
    await deps.supabaseFetch(`blog_posts?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ published: publish, publish_status: publish ? 'published' : 'draft', published_at: publish ? now() : null, scheduled_at: null, archived_at: null, updated_at: now() }) }); return reply.code(204).send()
  })
  app.patch('/api/v1/admin/blog/:id/lifecycle', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const { id } = z.object({ id: uuid }).parse(request.params)
    const body = z.discriminatedUnion('status', [
      z.object({ status: z.literal('draft') }), z.object({ status: z.literal('published') }),
      z.object({ status: z.literal('archived') }),
      z.object({ status: z.literal('scheduled'), scheduledAt: z.string().datetime().refine((date) => new Date(date).getTime() > Date.now(), 'Schedule time must be in the future.') }),
    ]).parse(request.body)
    if (body.status === 'published' || body.status === 'scheduled') {
      const posts = await deps.supabaseFetch<Array<{ cover_url?: string | null; cover_alt_text?: string | null }>>(`blog_posts?id=eq.${id}&select=cover_url,cover_alt_text&limit=1`)
      if (!posts[0]) return reply.code(404).send({ error: 'Post not found.' })
      if (posts[0].cover_url && !posts[0].cover_alt_text?.trim()) return reply.code(400).send({ error: 'Cover image alt text is required before publishing.' })
    }
    const schedule = body.status === 'scheduled' ? body.scheduledAt : null
    const publishedAt = body.status === 'published' ? now() : schedule
    await deps.supabaseFetch(`blog_posts?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({
      publish_status: body.status, published: body.status === 'published' || body.status === 'scheduled',
      published_at: publishedAt, scheduled_at: schedule, archived_at: body.status === 'archived' ? now() : null, updated_at: now(),
    }) })
    return reply.code(204).send()
  })
  app.post('/api/v1/admin/blog/media/uploads', { preHandler: deps.requireAdmin }, async (request, reply) => {
    if (!deps.supabaseStorageFetch || !deps.supabaseUrl) throw Object.assign(new Error('Blog media storage is unavailable.'), { statusCode: 503 })
    const user = await deps.requireAdmin(request)
    const body = z.object({ filename: z.string().min(1).max(200), mimeType: z.enum(['image/jpeg','image/png','image/webp','image/gif']), sizeBytes: z.number().int().positive().max(10 * 1024 * 1024) }).parse(request.body)
    const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' } as const)[body.mimeType]
    const storagePath = `${String(user.sub)}/${new Date().getUTCFullYear()}/${randomUUID()}.${extension}`
    const signed = await deps.supabaseStorageFetch<{ url: string }>(`object/upload/sign/blog-media/${storagePath.split('/').map(encodeURIComponent).join('/')}`, { method: 'POST', body: '{}' })
    return reply.code(201).send({ storagePath, uploadUrl: new URL(signed.url, `${deps.supabaseUrl}/storage/v1/`).toString(), publicUrl: `${deps.supabaseUrl}/storage/v1/object/public/blog-media/${storagePath}`, expiresIn: 7_200 })
  })
  app.delete('/api/v1/admin/blog/:id', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const { id } = z.object({ id: uuid }).parse(request.params); await deps.supabaseFetch(`blog_posts?id=eq.${id}`, { method: 'DELETE' }); return reply.code(204).send()
  })
}
