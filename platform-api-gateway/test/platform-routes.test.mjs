import assert from 'node:assert/strict'
import test from 'node:test'
import Fastify from 'fastify'
import { registerPlatformRoutes } from '../dist/platform-routes.js'

function appWithMailboxFake() {
  const calls = []; let sentPayload
  const app = Fastify()
  registerPlatformRoutes(app, {
    config: { supabaseUrl: 'https://example.supabase.co', supabaseServiceRoleKey: 'service', resendApiKey: 'resend', siteUrl: 'https://online2day.com', emailFrom: 'Online2Day <hello@online2day.com>', emailReplyTo: 'hello@online2day.com', gatewayServerKey: 'server-key' },
    requireAdmin: async () => ({ sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }), requireServerKey: async () => {},
    requestJson: async (_url, init) => { sentPayload = JSON.parse(init.body); calls.push({ kind: 'resend', init }); return { id: 'provider-123' } },
    supabaseStorageFetch: async () => ({ signedURL: '/object/sign/platform-documents/file.pdf?token=signed' }),
    supabaseFetch: async (path, init = {}) => {
      calls.push({ kind: 'supabase', path, init })
      if (path.startsWith('emails?mailbox_owner_id') && path.includes('headers->>')) return []
      if (path.startsWith('platform_documents?owner_user_id')) return [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', owner_user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', filename: 'proposal.pdf', safe_filename: 'proposal.pdf', mime_type: 'application/pdf', size_bytes: 1024, storage_path: 'owner/proposal.pdf', sha256: 'hash', document_kind: 'attachment', page_count: 1, created_at: new Date().toISOString() }]
      if (path === 'email_threads?select=id' && init.method === 'POST') return [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }]
      if (path === 'emails?select=id' && init.method === 'POST') return [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }]
      if (path.startsWith('emails?thread_id=')) return [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }]
      if (path.includes('&select=id,thread_id')) return [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', thread_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }]
      if (path.includes('&folder=eq.trash&select=id,direction,status')) return [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', direction: 'inbound', status: 'received' }]
      if (path.includes('&folder=eq.trash&select=id')) return [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }]
      if (path.includes('&select=id') && path.startsWith('emails?id=eq.')) return [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }]
      return []
    },
  })
  return { app, calls, getSentPayload: () => sentPayload }
}

test('mailbox send preserves CC/BCC, threads the message and uses idempotency', async () => {
  const { app, calls, getSentPayload } = appWithMailboxFake()
  const response = await app.inject({ method: 'POST', url: '/api/v1/online2day/mailbox/send', payload: { to: ['to@example.com'], cc: ['cc@example.com'], bcc: ['bcc@example.com'], subject: 'Proposal', htmlBody: '<p>Hello</p>', plainBody: 'Hello', priority: 'high', attachmentIds: [], idempotencyKey: 'request-12345678' } })
  assert.equal(response.statusCode, 201)
  assert.deepEqual(getSentPayload().cc, ['cc@example.com'])
  assert.deepEqual(getSentPayload().bcc, ['bcc@example.com'])
  const resendCall = calls.find((call) => call.kind === 'resend')
  assert.equal(resendCall.init.headers['Idempotency-Key'], 'request-12345678')
  assert.ok(calls.some((call) => call.kind === 'supabase' && call.path === 'emails?select=id'))
  await app.close()
})

test('mailbox send validates owned PDF attachments and supplies secure provider URLs', async () => {
  const { app, calls, getSentPayload } = appWithMailboxFake()
  const response = await app.inject({ method: 'POST', url: '/api/v1/online2day/mailbox/send', payload: { to: ['to@example.com'], cc: [], bcc: [], subject: 'Attached proposal', htmlBody: '<p>Please review</p>', plainBody: 'Please review', priority: 'normal', attachmentIds: ['dddddddd-dddd-4ddd-8ddd-dddddddddddd'], idempotencyKey: 'attachment-request-123' } })
  assert.equal(response.statusCode, 201)
  assert.equal(getSentPayload().attachments[0].filename, 'proposal.pdf')
  assert.match(getSentPayload().attachments[0].path, /token=signed/)
  assert.ok(calls.some((call) => call.kind === 'supabase' && call.path === 'email_attachments'))
  await app.close()
})

test('read state and Trash transitions persist server-side', async () => {
  const { app, calls } = appWithMailboxFake()
  const read = await app.inject({ method: 'PATCH', url: '/api/v1/online2day/mailbox/cccccccc-cccc-4ccc-8ccc-cccccccccccc/read', payload: { read: true } })
  assert.equal(read.statusCode, 200)
  assert.ok(calls.some((call) => call.kind === 'supabase' && call.init.method === 'PATCH' && JSON.parse(call.init.body).is_read === true))
  const removed = await app.inject({ method: 'DELETE', url: '/api/v1/online2day/mailbox/cccccccc-cccc-4ccc-8ccc-cccccccccccc' })
  assert.equal(removed.statusCode, 204)
  assert.ok(calls.some((call) => call.kind === 'supabase' && call.init.method === 'PATCH' && JSON.parse(call.init.body).folder === 'trash'))
  const restored = await app.inject({ method: 'POST', url: '/api/v1/online2day/mailbox/cccccccc-cccc-4ccc-8ccc-cccccccccccc/restore' })
  assert.equal(restored.statusCode, 200)
  assert.ok(calls.some((call) => call.kind === 'supabase' && call.init.method === 'PATCH' && JSON.parse(call.init.body).folder === 'inbox'))
  const erased = await app.inject({ method: 'DELETE', url: '/api/v1/online2day/mailbox/cccccccc-cccc-4ccc-8ccc-cccccccccccc/permanent' })
  assert.equal(erased.statusCode, 204)
  assert.ok(calls.some((call) => call.kind === 'supabase' && call.init.method === 'DELETE' && call.path.startsWith('emails?id=eq.')))
  await app.close()
})

test('signature requests store only token hashes and create recipient-specific secure links', async () => {
  const calls = []; const emails = []; const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; const documentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  const document = { id: documentId, owner_user_id: owner, filename: 'agreement.pdf', safe_filename: 'agreement.pdf', mime_type: 'application/pdf', size_bytes: 1200, storage_path: `${owner}/agreement.pdf`, sha256: 'original-hash', document_kind: 'signature_original', page_count: 2, created_at: new Date().toISOString() }
  const app = Fastify()
  registerPlatformRoutes(app, {
    config: { supabaseUrl: 'https://example.supabase.co', supabaseServiceRoleKey: 'service', resendApiKey: 'resend', siteUrl: 'https://online2day.com', emailFrom: 'Online2Day <hello@online2day.com>', emailReplyTo: 'hello@online2day.com', gatewayServerKey: 'server-key' },
    requireAdmin: async () => ({ sub: owner }), requireServerKey: async () => {}, supabaseStorageFetch: async () => ({ signedURL: '/signed' }),
    requestJson: async (_url, init) => { emails.push(JSON.parse(init.body)); return { id: 'provider' } },
    supabaseFetch: async (path, init = {}) => {
      calls.push({ path, init })
      if (path.startsWith(`platform_documents?id=eq.${documentId}`)) return [document]
      if (path === 'signature_requests?select=id' && init.method === 'POST') return [{ id: '11111111-1111-4111-8111-111111111111' }]
      if (path === 'signature_recipients?select=id' && init.method === 'POST') return [{ id: crypto.randomUUID() }]
      return []
    },
  })
  const response = await app.inject({ method: 'POST', url: '/api/v1/online2day/signature-requests', payload: { documentId, title: 'Sign this', message: 'Please sign', recipients: [{ name: 'Ada', email: 'ada@example.com', signingOrder: 1, fields: [{ fieldType: 'signature', pageNumber: 1, x: .1, y: .1, width: .3, height: .1, required: true, label: 'Signature' }] }, { name: 'Grace', email: 'grace@example.com', signingOrder: 2, fields: [{ fieldType: 'date', pageNumber: 2, x: .5, y: .7, width: .2, height: .05, required: true, label: 'Date' }] }] } })
  assert.equal(response.statusCode, 201)
  const body = response.json(); assert.equal(body.recipients.length, 2); assert.ok(body.recipients.every((recipient) => recipient.url.match(/\/sign\/[A-Za-z0-9_-]{32,}/)))
  const recipientWrites = calls.filter((call) => call.path === 'signature_recipients?select=id').map((call) => JSON.parse(call.init.body))
  assert.ok(recipientWrites.every((write) => /^[a-f0-9]{64}$/.test(write.token_hash)))
  assert.ok(recipientWrites.every((write) => !body.recipients.some((recipient) => recipient.url.endsWith(write.token_hash))))
  assert.equal(emails.length, 2)
  await app.close()
})

test('expired and invalid signing tokens fail without exposing documents', async () => {
  const token = 'x'.repeat(48); const calls = []; const app = Fastify()
  registerPlatformRoutes(app, {
    config: { supabaseUrl: 'https://example.supabase.co', supabaseServiceRoleKey: 'service', resendApiKey: 'resend', siteUrl: 'https://online2day.com', emailFrom: 'hello@online2day.com', emailReplyTo: 'hello@online2day.com', gatewayServerKey: 'server-key' },
    requireAdmin: async () => ({ sub: 'owner' }), requireServerKey: async () => {}, requestJson: async () => ({}), supabaseStorageFetch: async () => { throw new Error('must not sign document') },
    supabaseFetch: async (path, init = {}) => { calls.push({ path, init }); if (path.startsWith('signature_recipients?token_hash=')) return [{ id: '22222222-2222-4222-8222-222222222222', request_id: '11111111-1111-4111-8111-111111111111', name: 'Ada', email: 'ada@example.com', status: 'sent' }]; if (path.startsWith('signature_requests?id=eq.')) return [{ id: '11111111-1111-4111-8111-111111111111', title: 'Expired', message: '', status: 'sent', expires_at: '2020-01-01T00:00:00.000Z', document_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }]; return [] },
  })
  const expired = await app.inject({ method: 'GET', url: `/api/v1/public/signatures/${token}` })
  assert.equal(expired.statusCode, 410)
  assert.ok(calls.some((call) => call.path.startsWith('signature_requests?id=eq.') && call.init.method === 'PATCH'))
  const invalidApp = Fastify(); registerPlatformRoutes(invalidApp, { config: { supabaseUrl: 'https://example.supabase.co', supabaseServiceRoleKey: 'service', resendApiKey: 'resend', siteUrl: 'https://online2day.com', emailFrom: 'hello@online2day.com', emailReplyTo: 'hello@online2day.com', gatewayServerKey: 'server-key' }, requireAdmin: async () => ({ sub: 'owner' }), requireServerKey: async () => {}, requestJson: async () => ({}), supabaseStorageFetch: async () => ({}), supabaseFetch: async () => [] })
  assert.equal((await invalidApp.inject({ method: 'GET', url: `/api/v1/public/signatures/${'z'.repeat(48)}` })).statusCode, 404)
  await app.close(); await invalidApp.close()
})

test('inbound provider events thread by message metadata and sanitise HTML before persistence', async () => {
  const calls = []; const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; const thread = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; const app = Fastify()
  registerPlatformRoutes(app, {
    config: { supabaseUrl: 'https://example.supabase.co', supabaseServiceRoleKey: 'service', resendApiKey: 'resend', siteUrl: 'https://online2day.com', emailFrom: 'hello@online2day.com', emailReplyTo: 'hello@online2day.com', gatewayServerKey: 'server-key' },
    requireAdmin: async () => ({ sub: owner }), requireServerKey: async () => {}, supabaseStorageFetch: async () => ({}),
    requestJson: async () => ({ id: 'provider-inbound', to: ['hello@online2day.com'], from: 'Ada <ada@example.com>', created_at: '2026-09-01T12:00:00.000Z', subject: 'Re: Proposal', html: '<p>Hello<script>alert(1)</script><img src="https://tracker.invalid/pixel"></p>', text: 'Hello', headers: { from: 'Ada <ada@example.com>', 'in-reply-to': '<parent@example.com>', references: '<root@example.com> <parent@example.com>' }, bcc: [], cc: ['copy@example.com'], reply_to: [], message_id: '<reply@example.com>', attachments: [] }),
    supabaseFetch: async (path, init = {}) => { calls.push({ path, init }); if (path.startsWith('email_provider_events?')) return []; if (path.startsWith('user_profiles?email=')) return [{ user_id: owner, email: 'hello@online2day.com' }]; if (path.startsWith('emails?message_id=in.')) return [{ thread_id: thread }]; if (path === 'emails?select=id' && init.method === 'POST') return [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }]; if (path.startsWith(`emails?thread_id=eq.${thread}`)) return [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', is_read: false }]; return [] },
  })
  const response = await app.inject({ method: 'POST', url: '/api/v1/online2day/inbound-email-events', payload: { eventId: 'event-1', emailId: 'provider-inbound', createdAt: '2026-09-01T12:00:00.000Z' } })
  assert.equal(response.statusCode, 201)
  const write = calls.find((call) => call.path === 'emails?select=id' && call.init.method === 'POST'); const persisted = JSON.parse(write.init.body)
  assert.equal(persisted.thread_id, thread); assert.equal(persisted.is_read, false); assert.equal(persisted.sanitised_html_body.includes('<script'), false); assert.equal(persisted.sanitised_html_body.includes('<img'), false)
  await app.close()
})
