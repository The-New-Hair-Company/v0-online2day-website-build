import { createHash } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'

type Claims = Record<string, unknown> & { sub?: string; email?: string }
type Fetcher = <T>(path: string, init?: RequestInit) => Promise<T>

export type CommunicationRouteDeps = {
  requireUser: (request: FastifyRequest) => Promise<Claims>
  requireAdmin: (request: FastifyRequest) => Promise<Claims>
  requireWorkspaceMember: (request: FastifyRequest) => Promise<Claims>
  requireServerKey: (request: FastifyRequest) => Promise<void>
  supabaseFetch: Fetcher
  requestJson: <T>(url: string, init: RequestInit, attempts?: number) => Promise<T>
  whatsappAccessToken?: string
  whatsappPhoneNumberId?: string
  whatsappApiVersion?: string
}

const uuid = z.string().uuid()
const visitorToken = z.string().min(24).max(200)
const messageText = z.string().trim().min(1).max(5_000)
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const tokenNames = ['background', 'surface', 'surfaceAlt', 'text', 'muted', 'primary', 'primaryText', 'primaryHover', 'border'] as const
const tokenSchema = z.object(Object.fromEntries(tokenNames.map((name) => [name, hex])) as Record<(typeof tokenNames)[number], typeof hex>)
const brandingSchema = z.object({ light: tokenSchema, dark: tokenSchema })

type MessageRow = {
  id: string
  conversation_id: string | null
  sender_id: string | null
  conversation_user_id?: string | null
  recipient_id: string | null
  sender_type: string
  channel: string
  content: string
  is_read: boolean
  delivery_status: string
  external_provider_id: string | null
  external_status: string | null
  attachment_label: string | null
  attachment_url: string | null
  created_at: string
}

type ConversationRow = {
  id: string
  contact_name: string
  company: string | null
  channel: string | null
  status: string | null
  priority: string | null
  unread_count: number | null
  last_message_preview: string | null
  last_message_at: string | null
  contact_email?: string | null
  contact_phone?: string | null
  messages?: MessageRow[]
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function encode(value: string) {
  return encodeURIComponent(value)
}

function requiredRow<T>(row: T | undefined, label: string): T {
  if (!row) throw new Error(`${label} was not returned by the database.`)
  return row
}

function messageDto(row: MessageRow, currentUserId?: string) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    senderType: row.sender_type,
    channel: row.channel,
    content: row.content,
    isMine: Boolean(currentUserId && row.sender_id === currentUserId),
    isRead: row.is_read,
    deliveryStatus: row.delivery_status,
    externalProviderId: row.external_provider_id,
    externalStatus: row.external_status,
    attachmentLabel: row.attachment_label,
    attachmentUrl: row.attachment_url,
    createdAt: row.created_at,
  }
}

function conversationDto(row: ConversationRow, currentUserId?: string) {
  const messages = row.messages || []
  const personalUnread = currentUserId ? messages.filter((message) => !message.is_read && message.sender_id !== currentUserId && (message.recipient_id === currentUserId || message.conversation_user_id === currentUserId)).length : null
  return {
    id: row.id,
    name: row.contact_name,
    company: row.company,
    channel: String(row.channel || 'Web'),
    status: row.status || 'Open',
    priority: row.priority || 'Medium',
    unread: Math.max(0, personalUnread ?? row.unread_count ?? 0),
    preview: row.last_message_preview || '',
    lastMessageAt: row.last_message_at,
    contactEmail: row.contact_email || null,
    contactPhone: row.contact_phone || null,
    messages: messages.map((message) => messageDto(message, currentUserId)),
  }
}

const messageSelect = 'id,conversation_id,conversation_user_id,sender_id,recipient_id,sender_type,channel,content,is_read,delivery_status,external_provider_id,external_status,attachment_label,attachment_url,created_at'
const conversationSelect = `id,contact_name,company,channel,status,priority,unread_count,last_message_preview,last_message_at,contact_email,contact_phone,messages(${messageSelect})`

async function loadVisitorSession(deps: CommunicationRouteDeps, token: string) {
  const rows = await deps.supabaseFetch<Array<{ id: string; conversation_id: string; expires_at: string }>>(
    `visitor_chat_sessions?token_hash=eq.${sha256(token)}&expires_at=gt.${encode(new Date().toISOString())}&select=id,conversation_id,expires_at&limit=1`,
    { headers: { Accept: 'application/json' } },
  )
  return rows[0] || null
}

async function requireConversationAccess(deps: CommunicationRouteDeps, userId: string, conversationId: string) {
  const rows = await deps.supabaseFetch<Array<{ conversation_id: string }>>(
    `conversation_participants?conversation_id=eq.${encode(conversationId)}&user_id=eq.${encode(userId)}&select=conversation_id&limit=1`,
    { headers: { Accept: 'application/json' } },
  )
  if (rows[0]) return
  const supportMessages = await deps.supabaseFetch<Array<{ id: string }>>(
    `messages?conversation_id=eq.${encode(conversationId)}&conversation_user_id=eq.${encode(userId)}&select=id&limit=1`,
    { headers: { Accept: 'application/json' } },
  )
  if (!supportMessages[0]) throw Object.assign(new Error('Conversation not found.'), { statusCode: 404 })
}

export function registerCommunicationRoutes(app: FastifyInstance, deps: CommunicationRouteDeps) {
  app.get('/api/v1/online2day/site-branding', async () => {
    const rows = await deps.supabaseFetch<Array<{ light_tokens: Record<string, string>; dark_tokens: Record<string, string>; updated_at: string }>>(
      'site_branding?id=eq.true&select=light_tokens,dark_tokens,updated_at&limit=1',
      { headers: { Accept: 'application/json' } },
    )
    const row = rows[0]
    return row ? { light: row.light_tokens, dark: row.dark_tokens, updatedAt: row.updated_at } : null
  })

  app.put('/api/v1/online2day/site-branding', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request)
    const body = brandingSchema.parse(request.body)
    await deps.supabaseFetch('site_branding?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: true, light_tokens: body.light, dark_tokens: body.dark, updated_by: String(user.sub), updated_at: new Date().toISOString() }),
    })
    return reply.code(204).send()
  })

  app.post('/api/v1/online2day/public-chat/session', {
    preHandler: deps.requireServerKey,
    config: { rateLimit: { max: 12, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const body = z.object({
      token: visitorToken,
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(254).optional(),
      topic: z.string().trim().min(1).max(120).optional(),
    }).parse(request.body)
    const existing = await loadVisitorSession(deps, body.token)
    if (existing) return { conversationId: existing.conversation_id, resumed: true }

    const now = new Date().toISOString()
    const conversations = await deps.supabaseFetch<ConversationRow[]>('conversations?select=*', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({
        contact_name: body.name,
        contact_email: body.email || null,
        company: body.topic || 'Website visitor',
        channel: 'Web',
        status: 'Open',
        priority: 'Medium',
        unread_count: 0,
        last_message_preview: 'Conversation started',
        last_message_at: now,
        metadata: { source: 'public_website_chat', topic: body.topic || null },
      }),
    })
    const conversation = conversations[0]
    if (!conversation) throw new Error('The conversation could not be started.')
    await deps.supabaseFetch('visitor_chat_sessions', {
      method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
        token_hash: sha256(body.token),
        conversation_id: conversation.id,
        visitor_name: body.name,
        visitor_email: body.email || null,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    })
    return reply.code(201).send({ conversationId: conversation.id, resumed: false })
  })

  app.post('/api/v1/online2day/public-chat/messages/list', {
    preHandler: deps.requireServerKey,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { token } = z.object({ token: visitorToken }).parse(request.body)
    const session = await loadVisitorSession(deps, token)
    if (!session) return reply.code(404).send({ error: 'Chat session not found or expired.' })
    const messages = await deps.supabaseFetch<MessageRow[]>(
      `messages?conversation_id=eq.${encode(session.conversation_id)}&select=${messageSelect}&order=created_at.asc&limit=250`,
      { headers: { Accept: 'application/json' } },
    )
    return { conversationId: session.conversation_id, messages: messages.map((message) => messageDto(message)) }
  })

  app.post('/api/v1/online2day/public-chat/messages', {
    preHandler: deps.requireServerKey,
    config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const body = z.object({ token: visitorToken, content: messageText }).parse(request.body)
    const session = await loadVisitorSession(deps, body.token)
    if (!session) return reply.code(404).send({ error: 'Chat session not found or expired.' })
    const now = new Date().toISOString()
    const rows = await deps.supabaseFetch<MessageRow[]>('messages?select=*', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({
        conversation_id: session.conversation_id,
        sender_type: 'visitor',
        channel: 'web',
        content: body.content,
        is_read: false,
        delivery_status: 'sent',
      }),
    })
    await Promise.all([
      deps.supabaseFetch('rpc/record_conversation_activity', {
        method: 'POST', body: JSON.stringify({ p_conversation_id: session.conversation_id, p_preview: body.content, p_increment_unread: true, p_activity_at: now }),
      }),
      deps.supabaseFetch(`visitor_chat_sessions?id=eq.${encode(session.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_seen_at: now }),
      }),
    ])
    return reply.code(201).send(messageDto(requiredRow(rows[0], 'Chat message')))
  })

  app.get('/api/v1/online2day/me/conversations', { preHandler: deps.requireUser }, async (request) => {
    const user = await deps.requireUser(request)
    const userId = String(user.sub)
    const participantRows = await deps.supabaseFetch<Array<{ conversation_id: string }>>(
      `conversation_participants?user_id=eq.${encode(userId)}&select=conversation_id&limit=200`,
      { headers: { Accept: 'application/json' } },
    )
    const supportRows = await deps.supabaseFetch<Array<{ conversation_id: string | null }>>(
      `messages?conversation_user_id=eq.${encode(userId)}&conversation_id=not.is.null&select=conversation_id&limit=200`,
      { headers: { Accept: 'application/json' } },
    )
    const ids = [...new Set([...participantRows.map((row) => row.conversation_id), ...supportRows.map((row) => row.conversation_id).filter(Boolean) as string[]])]
    if (!ids.length) return []
    const rows = await deps.supabaseFetch<ConversationRow[]>(
      `conversations?id=in.(${ids.map(encode).join(',')})&select=${conversationSelect}&order=last_message_at.desc&limit=200&messages.order=created_at.asc&messages.limit=250`,
      { headers: { Accept: 'application/json' } },
    )
    return rows.map((row) => conversationDto(row, userId))
  })

  app.post('/api/v1/online2day/me/support', { preHandler: deps.requireUser }, async (request, reply) => {
    const user = await deps.requireUser(request)
    const userId = String(user.sub)
    const email = typeof user.email === 'string' ? user.email : ''
    const existingMessages = await deps.supabaseFetch<Array<{ conversation_id: string | null }>>(
      `messages?conversation_user_id=eq.${encode(userId)}&conversation_id=not.is.null&select=conversation_id&order=created_at.desc&limit=1`,
      { headers: { Accept: 'application/json' } },
    )
    if (existingMessages[0]?.conversation_id) return { conversationId: existingMessages[0].conversation_id }
    const now = new Date().toISOString()
    const conversations = await deps.supabaseFetch<ConversationRow[]>('conversations?select=*', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({
        contact_name: email || 'Customer', contact_email: email || null, company: 'Customer portal', channel: 'Support', status: 'Open',
        priority: 'Medium', created_by: userId, assigned_to: userId, last_message_at: now, metadata: { source: 'authenticated_support' },
      }),
    })
    const conversation = requiredRow(conversations[0], 'Support conversation')
    await deps.supabaseFetch('conversation_participants?on_conflict=conversation_id,user_id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ conversation_id: conversation.id, user_id: userId, participant_role: 'support' }),
    })
    return reply.code(201).send({ conversationId: conversation.id })
  })

  app.get('/api/v1/online2day/workspace-members', { preHandler: deps.requireWorkspaceMember }, async (request) => {
    const user = await deps.requireWorkspaceMember(request)
    const currentEmail = typeof user.email === 'string' ? user.email.toLowerCase() : ''
    const [licenses, profiles] = await Promise.all([
      deps.supabaseFetch<Array<{ email: string; full_name: string | null; role: string }>>('licensed_users?status=eq.active&select=email,full_name,role&order=full_name.asc,email.asc&limit=200'),
      deps.supabaseFetch<Array<{ user_id: string; email: string; full_name: string | null }>>('user_profiles?select=user_id,email,full_name&limit=500'),
    ])
    const profileByEmail = new Map(profiles.map((profile) => [profile.email.toLowerCase(), profile]))
    return licenses.flatMap((license) => {
      const profile = profileByEmail.get(license.email.toLowerCase())
      if (!profile || license.email.toLowerCase() === currentEmail) return []
      return [{ id: profile.user_id, name: license.full_name || profile.full_name || license.email, email: license.email, role: license.role }]
    })
  })

  app.post('/api/v1/online2day/internal-conversations', { preHandler: deps.requireWorkspaceMember }, async (request, reply) => {
    const user = await deps.requireWorkspaceMember(request)
    const senderId = String(user.sub)
    const body = z.object({ recipientId: uuid, content: messageText }).parse(request.body)
    if (body.recipientId === senderId) return reply.code(400).send({ error: 'Choose another workspace member.' })
    const recipientProfiles = await deps.supabaseFetch<Array<{ user_id: string; email: string; full_name: string | null }>>(
      `user_profiles?user_id=eq.${encode(body.recipientId)}&select=user_id,email,full_name&limit=1`,
    )
    const recipient = recipientProfiles[0]
    if (!recipient) return reply.code(404).send({ error: 'Workspace member not found.' })
    const licenses = await deps.supabaseFetch<Array<{ email: string }>>(
      `licensed_users?email=eq.${encode(recipient.email.toLowerCase())}&status=eq.active&select=email&limit=1`,
    )
    if (!licenses[0]) return reply.code(403).send({ error: 'That account is not an active workspace member.' })
    const pair = [senderId, body.recipientId].sort().join(':')
    let conversations = await deps.supabaseFetch<ConversationRow[]>(
      `conversations?participant_key=eq.${encode(pair)}&select=*&limit=1`,
      { headers: { Accept: 'application/json' } },
    )
    if (!conversations[0]) {
      conversations = await deps.supabaseFetch<ConversationRow[]>('conversations?select=*', {
        method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({
          contact_name: recipient.full_name || recipient.email,
          contact_email: recipient.email,
          company: 'Online2Day workspace', channel: 'Internal', status: 'Open', priority: 'Medium',
          created_by: senderId, assigned_to: senderId, participant_key: pair, last_message_at: new Date().toISOString(),
          metadata: { source: 'internal_workspace' },
        }),
      })
      const createdConversation = requiredRow(conversations[0], 'Internal conversation')
      await deps.supabaseFetch('conversation_participants?on_conflict=conversation_id,user_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([
          { conversation_id: createdConversation.id, user_id: senderId, participant_role: 'member' },
          { conversation_id: createdConversation.id, user_id: body.recipientId, participant_role: 'member' },
        ]),
      })
    }
    const conversation = requiredRow(conversations[0], 'Internal conversation')
    const rows = await deps.supabaseFetch<MessageRow[]>('messages?select=*', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({
        conversation_id: conversation.id, sender_id: senderId, recipient_id: body.recipientId,
        sender_type: 'user', channel: 'internal', content: body.content, is_read: false, delivery_status: 'sent',
      }),
    })
    await deps.supabaseFetch(`conversations?id=eq.${encode(conversation.id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
        last_message_preview: body.content.slice(0, 120), last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }),
    })
    return reply.code(201).send({ conversationId: conversation.id, message: messageDto(requiredRow(rows[0], 'Internal message'), senderId) })
  })

  app.get('/api/v1/online2day/message-recipients', { preHandler: deps.requireAdmin }, async () => {
    const rows = await deps.supabaseFetch<Array<{ user_id: string; email: string; full_name: string | null; role: string | null }>>(
      'user_profiles?role=neq.admin&select=user_id,email,full_name,role&order=full_name.asc,email.asc&limit=500',
    )
    return rows.map((row) => ({ id: row.user_id, email: row.email, name: row.full_name || row.email, role: row.role || 'user' }))
  })

  app.get('/api/v1/online2day/me/notifications', { preHandler: deps.requireUser }, async (request) => {
    const user = await deps.requireUser(request)
    return deps.supabaseFetch<Array<Record<string, unknown>>>(`notifications?user_id=eq.${encode(String(user.sub))}&select=id,user_id,title,detail,source,severity,read_at,created_at&order=created_at.desc&limit=50`)
  })

  app.post('/api/v1/online2day/me/notifications', { preHandler: deps.requireUser }, async (request, reply) => {
    const user = await deps.requireUser(request)
    const body = z.object({ userId: uuid.optional(), title: z.string().trim().min(1).max(240), detail: z.string().max(2_000).optional(), source: z.string().max(80).optional(), severity: z.enum(['info','warning','critical']).optional() }).parse(request.body)
    const target = body.userId || String(user.sub)
    if (target !== String(user.sub)) await deps.requireAdmin(request)
    const rows = await deps.supabaseFetch<Array<Record<string, unknown>>>('notifications?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ user_id: target, title: body.title, detail: body.detail || '', source: body.source || 'system', severity: body.severity || 'info' }) })
    return reply.code(201).send(requiredRow(rows[0], 'Notification'))
  })

  app.patch('/api/v1/online2day/me/notifications/read', { preHandler: deps.requireUser }, async (request) => {
    const user = await deps.requireUser(request)
    await deps.supabaseFetch(`notifications?user_id=eq.${encode(String(user.sub))}&read_at=is.null`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ read_at: new Date().toISOString() }) })
    return { success: true }
  })

  app.patch('/api/v1/online2day/me/notifications/:id/read', { preHandler: deps.requireUser }, async (request) => {
    const user = await deps.requireUser(request)
    const { id } = z.object({ id: uuid }).parse(request.params)
    await deps.supabaseFetch(`notifications?id=eq.${encode(id)}&user_id=eq.${encode(String(user.sub))}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ read_at: new Date().toISOString() }) })
    return { success: true }
  })

  app.post('/api/v1/online2day/users/:id/messages', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const actor = await deps.requireAdmin(request)
    const { id: recipientId } = z.object({ id: uuid }).parse(request.params)
    const body = z.object({ content: messageText }).parse(request.body)
    const profiles = await deps.supabaseFetch<Array<{ user_id: string; email: string; full_name: string | null }>>(`user_profiles?user_id=eq.${encode(recipientId)}&select=user_id,email,full_name&limit=1`)
    const recipient = profiles[0]
    if (!recipient) return reply.code(404).send({ error: 'Message recipient not found.' })
    const prior = await deps.supabaseFetch<Array<{ conversation_id: string | null }>>(`messages?conversation_user_id=eq.${encode(recipientId)}&conversation_id=not.is.null&select=conversation_id&order=created_at.desc&limit=1`)
    let conversationId = prior[0]?.conversation_id || null
    if (!conversationId) {
      const created = await deps.supabaseFetch<ConversationRow[]>('conversations?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({
        contact_name: recipient.full_name || recipient.email, contact_email: recipient.email, company: 'Customer portal', channel: 'Support', status: 'Open', priority: 'Medium', created_by: String(actor.sub), assigned_to: String(actor.sub), last_message_at: new Date().toISOString(), metadata: { source: 'admin_direct_message' },
      }) })
      conversationId = requiredRow(created[0], 'Direct conversation').id
    }
    const messages = await deps.supabaseFetch<MessageRow[]>('messages?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({
      conversation_id: conversationId, conversation_user_id: recipientId, sender_id: String(actor.sub), recipient_id: recipientId,
      sender_type: 'agent', channel: 'support', content: body.content, is_read: false, delivery_status: 'sent',
    }) })
    await deps.supabaseFetch('rpc/record_conversation_activity', { method: 'POST', body: JSON.stringify({ p_conversation_id: conversationId, p_preview: body.content, p_increment_unread: true, p_activity_at: new Date().toISOString() }) })
    return reply.code(201).send(messageDto(requiredRow(messages[0], 'Direct message'), String(actor.sub)))
  })

  app.post('/api/v1/online2day/my-conversations/:id/reply', { preHandler: deps.requireUser }, async (request, reply) => {
    const user = await deps.requireUser(request)
    const userId = String(user.sub)
    const { id } = z.object({ id: uuid }).parse(request.params)
    const body = z.object({ content: messageText }).parse(request.body)
    await requireConversationAccess(deps, userId, id)
    const conversationRows = await deps.supabaseFetch<Array<{ channel: string | null }>>(`conversations?id=eq.${encode(id)}&select=channel&limit=1`)
    const internal = String(conversationRows[0]?.channel || '').toLowerCase() === 'internal'
    let recipientId: string | null = null
    if (internal) {
      const participants = await deps.supabaseFetch<Array<{ user_id: string }>>(`conversation_participants?conversation_id=eq.${encode(id)}&user_id=neq.${encode(userId)}&select=user_id&limit=1`)
      recipientId = participants[0]?.user_id || null
    }
    const rows = await deps.supabaseFetch<MessageRow[]>('messages?select=*', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({
        conversation_id: id, conversation_user_id: internal ? null : userId, sender_id: userId, recipient_id: recipientId, sender_type: 'user',
        channel: internal ? 'internal' : 'support', content: body.content, is_read: false, delivery_status: 'sent',
      }),
    })
    await deps.supabaseFetch('rpc/record_conversation_activity', { method: 'POST', body: JSON.stringify({ p_conversation_id: id, p_preview: body.content, p_increment_unread: true, p_activity_at: new Date().toISOString() }) })
    return reply.code(201).send(messageDto(requiredRow(rows[0], 'Support message'), userId))
  })

  app.post('/api/v1/online2day/my-conversations/:id/read', { preHandler: deps.requireUser }, async (request) => {
    const user = await deps.requireUser(request)
    const userId = String(user.sub)
    const { id } = z.object({ id: uuid }).parse(request.params)
    await requireConversationAccess(deps, userId, id)
    const now = new Date().toISOString()
    await Promise.all([
      deps.supabaseFetch(`messages?conversation_id=eq.${encode(id)}&sender_id=neq.${encode(userId)}&is_read=eq.false`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ is_read: true }),
      }),
      deps.supabaseFetch(`conversation_participants?conversation_id=eq.${encode(id)}&user_id=eq.${encode(userId)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_read_at: now }),
      }),
    ])
    return { success: true }
  })

  app.get('/api/v1/online2day/whatsapp/status', { preHandler: deps.requireAdmin }, async () => ({
    configured: Boolean(deps.whatsappAccessToken && deps.whatsappPhoneNumberId),
    provider: 'Meta WhatsApp Cloud API',
  }))

  app.post('/api/v1/online2day/conversations/:id/whatsapp', { preHandler: deps.requireAdmin }, async (request, reply) => {
    const user = await deps.requireAdmin(request)
    if (!deps.whatsappAccessToken || !deps.whatsappPhoneNumberId) {
      return reply.code(503).send({ error: 'WhatsApp is not connected. Add the Meta Cloud API credentials in the Azure gateway.' })
    }
    const { id } = z.object({ id: uuid }).parse(request.params)
    const body = z.object({ to: z.string().trim().regex(/^\+?[1-9]\d{7,14}$/), content: messageText }).parse(request.body)
    const sent = await deps.requestJson<{ messages?: Array<{ id: string }> }>(
      `https://graph.facebook.com/${deps.whatsappApiVersion || 'v23.0'}/${deps.whatsappPhoneNumberId}/messages`,
      { method: 'POST', headers: { Authorization: `Bearer ${deps.whatsappAccessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({
        messaging_product: 'whatsapp', to: body.to.replace(/^\+/, ''), type: 'text', text: { body: body.content, preview_url: false },
      }) },
    )
    const providerId = sent.messages?.[0]?.id
    if (!providerId) throw new Error('WhatsApp did not return a message identifier.')
    const rows = await deps.supabaseFetch<MessageRow[]>('messages?select=*', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({
        conversation_id: id, sender_id: String(user.sub), sender_type: 'agent', channel: 'whatsapp', content: body.content,
        is_read: true, delivery_status: 'sent', external_provider_id: providerId, external_status: 'accepted',
      }),
    })
    await deps.supabaseFetch(`conversations?id=eq.${encode(id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
        channel: 'WhatsApp', contact_phone: body.to, last_message_preview: body.content.slice(0, 120),
        last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }),
    })
    return reply.code(201).send(messageDto(requiredRow(rows[0], 'WhatsApp message'), String(user.sub)))
  })

  app.post('/api/v1/online2day/whatsapp/inbound', {
    preHandler: deps.requireServerKey,
    config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const body = z.object({ eventId: z.string().min(1).max(200), payload: z.record(z.string(), z.unknown()) }).parse(request.body)
    const existing = await deps.supabaseFetch<Array<{ id: string }>>(
      `communication_provider_events?provider=eq.whatsapp&provider_event_id=eq.${encode(body.eventId)}&select=id&limit=1`,
    )
    if (existing[0]) return { accepted: true, processed: false }

    const entries = (body.payload.entry as Array<Record<string, unknown>> | undefined) || []
    let processed = 0
    for (const entry of entries) {
      const changes = (entry.changes as Array<Record<string, unknown>> | undefined) || []
      for (const change of changes) {
        const value = (change.value as Record<string, unknown> | undefined) || {}
        const messages = (value.messages as Array<Record<string, unknown>> | undefined) || []
        const contacts = (value.contacts as Array<Record<string, unknown>> | undefined) || []
        for (const incoming of messages) {
          const providerId = String(incoming.id || '')
          const from = String(incoming.from || '')
          const text = String((incoming.text as Record<string, unknown> | undefined)?.body || '')
          if (!providerId || !from || !text) continue
          const duplicateMessages = await deps.supabaseFetch<Array<{ id: string }>>(`messages?channel=eq.whatsapp&external_provider_id=eq.${encode(providerId)}&select=id&limit=1`)
          if (duplicateMessages[0]) continue
          let conversations = await deps.supabaseFetch<ConversationRow[]>(
            `conversations?channel=eq.WhatsApp&contact_phone=eq.${encode(from)}&select=*&order=last_message_at.desc&limit=1`,
          )
          if (!conversations[0]) {
            const profile = (contacts[0]?.profile as Record<string, unknown> | undefined) || {}
            conversations = await deps.supabaseFetch<ConversationRow[]>('conversations?select=*', {
              method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({
                contact_name: String(profile.name || from), contact_phone: from, company: 'WhatsApp contact', channel: 'WhatsApp',
                status: 'Open', priority: 'Medium', unread_count: 0, metadata: { source: 'whatsapp_cloud' },
              }),
            })
          }
          const conversation = requiredRow(conversations[0], 'WhatsApp conversation')
          const inserted = await deps.supabaseFetch<MessageRow[]>('messages?select=*', {
            method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({
              conversation_id: conversation.id, sender_type: 'provider', channel: 'whatsapp', content: text, is_read: false,
              delivery_status: 'delivered', external_provider_id: providerId, external_status: 'received', metadata: incoming,
            }),
          })
          await deps.supabaseFetch('communication_provider_events', {
            method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
              provider: 'whatsapp', provider_event_id: providerId, conversation_id: conversation.id,
              message_id: inserted[0]?.id || null, event_type: 'message.received', metadata: incoming,
            }),
          })
          await deps.supabaseFetch('rpc/record_conversation_activity', {
            method: 'POST', body: JSON.stringify({
              p_conversation_id: conversation.id, p_preview: text, p_increment_unread: true,
              p_activity_at: new Date(Number(incoming.timestamp || 0) * 1000 || Date.now()).toISOString(),
            }),
          })
          processed += 1
        }
        const statuses = (value.statuses as Array<Record<string, unknown>> | undefined) || []
        for (const status of statuses) {
          const providerId = String(status.id || '')
          const state = String(status.status || '')
          if (!providerId || !['sent', 'delivered', 'read', 'failed'].includes(state)) continue
          const matching = await deps.supabaseFetch<Array<{ id: string; conversation_id: string | null; delivery_status: string }>>(`messages?channel=eq.whatsapp&external_provider_id=eq.${encode(providerId)}&select=id,conversation_id,delivery_status&limit=1`)
          const message = matching[0]
          if (!message) continue
          const rank = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 4 } as const
          if ((rank[state as keyof typeof rank] ?? 0) >= (rank[message.delivery_status as keyof typeof rank] ?? 0)) {
            await deps.supabaseFetch(`messages?id=eq.${encode(message.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ delivery_status: state, external_status: state }) })
          }
          await deps.supabaseFetch('communication_provider_events', {
            method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({
              provider: 'whatsapp', provider_event_id: `${providerId}:${state}:${String(status.timestamp || '')}`,
              conversation_id: message.conversation_id, message_id: message.id, event_type: `message.${state}`, metadata: status,
            }),
          })
        }
      }
    }
    await deps.supabaseFetch('communication_provider_events', {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({
        provider: 'whatsapp', provider_event_id: body.eventId, event_type: 'webhook.received', metadata: { processed },
      }),
    })
    return reply.code(202).send({ accepted: true, processed: true, messages: processed })
  })
}
