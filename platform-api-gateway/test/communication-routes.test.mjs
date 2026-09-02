import assert from 'node:assert/strict'
import test from 'node:test'
import Fastify from 'fastify'
import { registerCommunicationRoutes } from '../dist/communication-routes.js'

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const recipientId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const conversationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const messageId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

function appWith(handler, overrides = {}) {
  const calls = []
  const app = Fastify()
  registerCommunicationRoutes(app, {
    requireUser: async () => ({ sub: userId, email: 'member@example.com' }),
    requireAdmin: async () => ({ sub: userId, email: 'admin@example.com' }),
    requireWorkspaceMember: async () => ({ sub: userId, email: 'member@example.com' }),
    requireServerKey: async () => {},
    supabaseFetch: async (path, init = {}) => { calls.push({ path, init }); return handler(path, init) },
    requestJson: async () => ({}),
    ...overrides,
  })
  return { app, calls }
}

test('public chat stores only a token hash and increments unread atomically', async () => {
  const token = 'visitor-token-with-enough-entropy-123456'
  let sessionCreated = false
  const { app, calls } = appWith(async (path, init) => {
    if (path.startsWith('visitor_chat_sessions?token_hash=')) return sessionCreated ? [{ id: recipientId, conversation_id: conversationId, expires_at: '2099-01-01T00:00:00.000Z' }] : []
    if (path === 'conversations?select=*' && init.method === 'POST') return [{ id: conversationId }]
    if (path === 'visitor_chat_sessions' && init.method === 'POST') { sessionCreated = true; return [] }
    if (path === 'messages?select=*' && init.method === 'POST') return [{ id: messageId, conversation_id: conversationId, sender_id: null, recipient_id: null, sender_type: 'visitor', channel: 'web', content: 'I need help', is_read: false, delivery_status: 'sent', external_provider_id: null, external_status: null, attachment_label: null, attachment_url: null, created_at: new Date().toISOString() }]
    return []
  })
  const started = await app.inject({ method: 'POST', url: '/api/v1/online2day/public-chat/session', payload: { token, name: 'Site visitor' } })
  assert.equal(started.statusCode, 201)
  const sent = await app.inject({ method: 'POST', url: '/api/v1/online2day/public-chat/messages', payload: { token, content: 'I need help' } })
  assert.equal(sent.statusCode, 201)
  const serializedCalls = JSON.stringify(calls)
  assert.equal(serializedCalls.includes(token), false)
  const activity = calls.find((call) => call.path === 'rpc/record_conversation_activity')
  assert.equal(JSON.parse(activity.init.body).p_increment_unread, true)
  await app.close()
})

test('internal messaging rejects recipients without an active workspace licence', async () => {
  const { app } = appWith(async (path) => {
    if (path.startsWith('user_profiles?user_id=')) return [{ user_id: recipientId, email: 'former@example.com', full_name: 'Former Member' }]
    if (path.startsWith('licensed_users?email=')) return []
    return []
  })
  const response = await app.inject({ method: 'POST', url: '/api/v1/online2day/internal-conversations', payload: { recipientId, content: 'Private message' } })
  assert.equal(response.statusCode, 403)
  await app.close()
})

test('internal messaging creates a private participant pair and persists the first message', async () => {
  const { app, calls } = appWith(async (path, init) => {
    if (path.startsWith('user_profiles?user_id=')) return [{ user_id: recipientId, email: 'active@example.com', full_name: 'Active Member' }]
    if (path.startsWith('licensed_users?email=')) return [{ email: 'active@example.com' }]
    if (path.startsWith('conversations?participant_key=')) return []
    if (path === 'conversations?select=*' && init.method === 'POST') return [{ id: conversationId }]
    if (path === 'messages?select=*' && init.method === 'POST') return [{ id: messageId, conversation_id: conversationId, sender_id: userId, recipient_id: recipientId, sender_type: 'user', channel: 'internal', content: 'Private message', is_read: false, delivery_status: 'sent', external_provider_id: null, external_status: null, attachment_label: null, attachment_url: null, created_at: new Date().toISOString() }]
    return []
  })
  const response = await app.inject({ method: 'POST', url: '/api/v1/online2day/internal-conversations', payload: { recipientId, content: 'Private message' } })
  assert.equal(response.statusCode, 201)
  const participants = calls.find((call) => call.path.startsWith('conversation_participants?on_conflict='))
  assert.deepEqual(JSON.parse(participants.init.body).map((row) => row.user_id).sort(), [recipientId, userId].sort())
  await app.close()
})

test('a user cannot reply to a conversation they do not participate in', async () => {
  const { app, calls } = appWith(async () => [])
  const response = await app.inject({ method: 'POST', url: `/api/v1/online2day/my-conversations/${conversationId}/reply`, payload: { content: 'Not allowed' } })
  assert.equal(response.statusCode, 404)
  assert.equal(calls.some((call) => call.path === 'messages?select=*' && call.init.method === 'POST'), false)
  await app.close()
})

test('WhatsApp is fail-closed when provider credentials are absent', async () => {
  const { app } = appWith(async () => [])
  const status = await app.inject({ method: 'GET', url: '/api/v1/online2day/whatsapp/status' })
  assert.deepEqual(status.json(), { configured: false, provider: 'Meta WhatsApp Cloud API' })
  const response = await app.inject({ method: 'POST', url: `/api/v1/online2day/conversations/${conversationId}/whatsapp`, payload: { to: '+447700900123', content: 'Hello' } })
  assert.equal(response.statusCode, 503)
  await app.close()
})

test('WhatsApp outbound stores the provider identifier only after the provider accepts it', async () => {
  const { app, calls } = appWith(async (path, init) => {
    if (path === 'messages?select=*' && init.method === 'POST') {
      const row = JSON.parse(init.body)
      return [{ ...row, id: messageId, recipient_id: null, attachment_label: null, attachment_url: null, created_at: new Date().toISOString() }]
    }
    return []
  }, { whatsappAccessToken: 'secret', whatsappPhoneNumberId: 'phone-id', requestJson: async () => ({ messages: [{ id: 'wamid.accepted' }] }) })
  const response = await app.inject({ method: 'POST', url: `/api/v1/online2day/conversations/${conversationId}/whatsapp`, payload: { to: '+447700900123', content: 'Hello' } })
  assert.equal(response.statusCode, 201)
  const insert = calls.find((call) => call.path === 'messages?select=*' && call.init.method === 'POST')
  assert.equal(JSON.parse(insert.init.body).external_provider_id, 'wamid.accepted')
  await app.close()
})

test('duplicate WhatsApp webhooks are acknowledged without reprocessing', async () => {
  const { app, calls } = appWith(async (path) => path.startsWith('communication_provider_events?provider=eq.whatsapp') ? [{ id: messageId }] : [])
  const response = await app.inject({ method: 'POST', url: '/api/v1/online2day/whatsapp/inbound', payload: { eventId: 'stable-event-id', payload: {} } })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { accepted: true, processed: false })
  assert.equal(calls.length, 1)
  await app.close()
})
