import assert from 'node:assert/strict'
import test from 'node:test'
import Fastify from 'fastify'
import { registerMediaRoutes } from '../dist/media-routes.js'

function mediaApp({ authorised = true, withIntro = true } = {}) {
  const calls = []
  const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const profile = { owner_user_id: owner, intro_enabled: true, intro_storage_path: withIntro ? `${owner}/intro/default.mp4` : null, intro_filename: withIntro ? 'default.mp4' : null, intro_mime_type: withIntro ? 'video/mp4' : null, intro_size_bytes: withIntro ? 2048 : null, intro_duration_seconds: withIntro ? 3.25 : null, intro_metadata: { width: 1920, height: 1080 } }
  const app = Fastify()
  app.setErrorHandler((error, _request, reply) => reply.code(error.name === 'ZodError' ? 400 : error.statusCode || 500).send({ error: error.message }))
  registerMediaRoutes(app, {
    config: { supabaseUrl: 'https://example.supabase.co', supabaseServiceRoleKey: 'service' },
    requireAdmin: async () => { if (!authorised) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 }); return { sub: owner } },
    supabaseStorageFetch: async (path) => { calls.push({ kind: 'storage', path }); return path.startsWith('object/upload/sign/') ? { url: '/object/upload/sign/video-branding/token' } : { signedURL: '/object/sign/video-branding/default.mp4?token=signed' } },
    supabaseFetch: async (path, init = {}) => { calls.push({ kind: 'database', path, init }); if (path.startsWith('media_processing_jobs?status=eq.queued')) return []; if (path.startsWith('video_branding_profiles?owner_user_id') && path.includes('select=id,intro_storage_path')) return [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', intro_storage_path: profile.intro_storage_path }]; if (path.startsWith('video_branding_profiles?owner_user_id') && path.includes('select=*')) return [profile]; return [] },
  })
  return { app, calls, owner }
}

test('returns persisted default intro metadata and a short-lived preview URL', async () => {
  const { app } = mediaApp()
  const response = await app.inject({ method: 'GET', url: '/api/v1/online2day/video-branding' })
  assert.equal(response.statusCode, 200)
  const body = response.json(); assert.equal(body.introEnabled, true); assert.equal(body.intro.durationSeconds, 3.25); assert.match(body.intro.previewUrl, /token=signed/)
  await app.close()
})

test('creates owner-scoped intro upload URLs and rejects malformed uploads', async () => {
  const { app, owner } = mediaApp()
  const response = await app.inject({ method: 'POST', url: '/api/v1/online2day/video-branding/intro/uploads', payload: { filename: '../brand intro.mp4', mimeType: 'video/mp4', sizeBytes: 4096 } })
  assert.equal(response.statusCode, 201)
  const body = response.json(); assert.ok(body.storagePath.startsWith(`${owner}/intro/`)); assert.equal(body.storagePath.includes('..'), false); assert.match(body.uploadUrl, /example\.supabase\.co/)
  const invalid = await app.inject({ method: 'POST', url: '/api/v1/online2day/video-branding/intro/uploads', payload: { filename: 'intro.exe', mimeType: 'application/octet-stream', sizeBytes: 4 } })
  assert.equal(invalid.statusCode, 400)
  await app.close()
})

test('intro enable, disable and removal persist server-side', async () => {
  const { app, calls } = mediaApp()
  const disabled = await app.inject({ method: 'PATCH', url: '/api/v1/online2day/video-branding/intro', payload: { enabled: false } })
  assert.equal(disabled.statusCode, 200); assert.equal(disabled.json().introEnabled, false)
  assert.ok(calls.some((call) => call.kind === 'database' && call.init.method === 'PATCH' && JSON.parse(call.init.body).intro_enabled === false))
  const removed = await app.inject({ method: 'DELETE', url: '/api/v1/online2day/video-branding/intro' })
  assert.equal(removed.statusCode, 204)
  assert.ok(calls.some((call) => call.kind === 'database' && call.init.method === 'PATCH' && JSON.parse(call.init.body).intro_storage_path === null))
  await app.close()
})

test('video branding and media jobs enforce authentication and owner scoping', async () => {
  const { app } = mediaApp({ authorised: false })
  assert.equal((await app.inject({ method: 'GET', url: '/api/v1/online2day/video-branding' })).statusCode, 401)
  await app.close()
  const scoped = mediaApp()
  assert.equal((await scoped.app.inject({ method: 'GET', url: '/api/v1/online2day/media-jobs/11111111-1111-4111-8111-111111111111' })).statusCode, 404)
  assert.ok(scoped.calls.some((call) => call.path?.includes('owner_user_id=eq.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')))
  await scoped.app.close()
})
