import assert from 'node:assert/strict'
import test from 'node:test'
import Fastify from 'fastify'
import { registerCompatRoutes } from '../dist/compat-routes.js'

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function buildFake(handler) {
  const calls = []; const app = Fastify()
  registerCompatRoutes(app, {
    requireAdmin: async () => ({ sub: owner }),
    supabaseFetch: async (path, init = {}) => { calls.push({ path, init }); return handler(path, init) },
  })
  return { app, calls }
}

test('compatibility leads API maps persisted CRM rows for dashboard reports', async () => {
  const { app } = buildFake(async (path) => path.startsWith('leads?select=*') ? [{
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Ada Lovelace', email: 'ada@example.com',
    phone: '01234', company: 'Analytical Engines', status: 'Qualified', source: 'Website',
    score: 92, value: 5000, created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z',
  }] : [])
  const response = await app.inject({ method: 'GET', url: '/api/v1/leads?status=Qualified' })
  assert.equal(response.statusCode, 200)
  assert.equal(response.json()[0].createdAt, '2026-09-01T00:00:00.000Z')
  assert.equal(response.json()[0].company, 'Analytical Engines')
  await app.close()
})

test('enterprise state, preferences and report snapshots use durable API storage', async () => {
  const { app, calls } = buildFake(async (path, init) => {
    if (path.startsWith('enterprise_state?key=')) return [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', key: 'enabled_features', value: ['one'], updated_at: '2026-09-01T00:00:00.000Z' }]
    if (path === 'report_snapshots?select=*' && init.method === 'POST') return [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', user_id: owner, period_label: 'Weekly', kpis: { leads: 9 }, created_by: owner, created_at: '2026-09-01T00:00:00.000Z' }]
    return []
  })
  const state = await app.inject({ method: 'GET', url: '/api/v1/enterprise/state/enabled_features' })
  assert.equal(state.statusCode, 200); assert.equal(state.json().value, '["one"]')
  assert.equal((await app.inject({ method: 'PUT', url: '/api/v1/admin/preferences/theme', payload: { value: 'dark' } })).statusCode, 204)
  const report = await app.inject({ method: 'POST', url: '/api/v1/reports/snapshots', payload: { type: 'Weekly', data: '{"leads":9}' } })
  assert.equal(report.statusCode, 201); assert.equal(report.json().type, 'Weekly')
  const prefWrite = calls.find((call) => call.path.startsWith('admin_preferences?on_conflict'))
  assert.equal(JSON.parse(prefWrite.init.body).user_id, owner)
  await app.close()
})

test('public blog returns only the published query and maps API fields', async () => {
  const { app, calls } = buildFake(async (path) => path.startsWith('blog_posts?published=eq.true') ? [{
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', slug: 'fast-safe-websites', title: 'Fast, safe websites',
    excerpt: 'A guide', content: '<p>Useful content</p>', category: 'Engineering', published: true,
    published_at: '2026-09-01T00:00:00.000Z', read_time: 4, author_name: 'Online2Day', author_role: 'Team',
    tags: ['Performance'], created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z',
  }] : [])
  const response = await app.inject({ method: 'GET', url: '/api/v1/blog' })
  assert.equal(response.statusCode, 200); assert.equal(response.json()[0].isPublished, true); assert.equal(response.json()[0].readTime, 4)
  assert.ok(calls[0].path.includes('published=eq.true'))
  assert.ok(calls[0].path.includes('published_at=lte.'))
  await app.close()
})

test('blog writes sanitise rich HTML and scheduling persists a real future publication time', async () => {
  const calls = []
  const { app } = buildFake(async (path, init) => {
    calls.push({ path, init })
    if (path === 'blog_posts?select=*' && init.method === 'POST') {
      const body = JSON.parse(init.body)
      return [{ ...body, id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', created_at: '2026-09-02T00:00:00.000Z' }]
    }
    if (path.includes('select=cover_url,cover_alt_text')) return [{ cover_url: null, cover_alt_text: null }]
    return []
  })
  const created = await app.inject({ method: 'POST', url: '/api/v1/admin/blog', payload: {
    slug: 'safe-rich-content', title: 'Safe rich content for production',
    content: '<p>Hello</p><img src="https://example.com/image.webp" alt="Example"><table><tbody><tr><td>Useful</td></tr></tbody></table><div data-youtube-video><iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe></div><script>alert(1)</script><a href="javascript:alert(1)">unsafe</a>',
  } })
  assert.equal(created.statusCode, 201)
  const createBody = JSON.parse(calls.find((call) => call.path === 'blog_posts?select=*').init.body)
  assert.equal(createBody.content.includes('<script'), false)
  assert.equal(createBody.content.includes('javascript:'), false)
  assert.equal(createBody.content.includes('<img'), true)
  assert.equal(createBody.content.includes('<table>'), true)
  assert.equal(createBody.content.includes('youtube-nocookie.com'), true)
  const scheduledAt = new Date(Date.now() + 86_400_000).toISOString()
  const scheduled = await app.inject({ method: 'PATCH', url: '/api/v1/admin/blog/dddddddd-dddd-4ddd-8ddd-dddddddddddd/lifecycle', payload: { status: 'scheduled', scheduledAt } })
  assert.equal(scheduled.statusCode, 204)
  const lifecycle = calls.find((call) => call.path.startsWith('blog_posts?id=eq.') && call.init.method === 'PATCH')
  const lifecycleBody = JSON.parse(lifecycle.init.body)
  assert.equal(lifecycleBody.publish_status, 'scheduled')
  assert.equal(lifecycleBody.published, true)
  assert.equal(lifecycleBody.published_at, scheduledAt)
  await app.close()
})

test('licensed users are stored durably and protected admins cannot be removed', async () => {
  const users = new Map()
  const { app } = buildFake(async (path, init) => {
    if (path.startsWith('licensed_users?select=')) return [...users.values()]
    if (path === 'licensed_users?on_conflict=email' && init.method === 'POST') {
      const row = JSON.parse(init.body)
      users.set(row.email, row)
      return []
    }
    return []
  })
  const [created, second] = await Promise.all([
    app.inject({ method: 'POST', url: '/api/v1/admin/licensed-users', payload: { email: 'new.user@example.com', fullName: 'New User', role: 'member' } }),
    app.inject({ method: 'POST', url: '/api/v1/admin/licensed-users', payload: { email: 'viewer@example.com', role: 'viewer' } }),
  ])
  assert.equal(created.statusCode, 201); assert.equal(second.statusCode, 201)
  assert.equal(created.json().seatType, 'standard'); assert.equal(second.json().seatType, 'viewer')
  const listed = await app.inject({ method: 'GET', url: '/api/v1/admin/licensed-users' })
  assert.equal(listed.statusCode, 200)
  assert.deepEqual(listed.json().map((user) => user.email).sort(), ['new.user@example.com', 'viewer@example.com'])
  const protectedDelete = await app.inject({ method: 'DELETE', url: '/api/v1/admin/licensed-users/info%40online2day.com' })
  assert.equal(protectedDelete.statusCode, 403)
  await app.close()
})

test('dashboard tasks and activity feed use durable Supabase compatibility routes', async () => {
  const taskId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  const leadId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const { app, calls } = buildFake(async (path) => {
    if (path.startsWith('lead_tasks?is_done=eq.false')) return [{
      id: taskId, lead_id: leadId, assigned_to: owner, title: 'Follow up',
      due_at: '2026-09-03T09:00:00.000Z', is_done: false,
      created_at: '2026-09-02T09:00:00.000Z', updated_at: null,
    }]
    if (path.startsWith('activity_feed?select=*')) return [{
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', actor_name: 'Online2Day',
      type: 'lead.updated', entity_type: 'lead', entity_id: leadId,
      entity_name: 'Prospect', description: 'Stage changed',
      created_at: '2026-09-02T10:00:00.000Z',
    }]
    return []
  })
  const tasks = await app.inject({ method: 'GET', url: '/api/v1/tasks/upcoming?limit=10' })
  assert.equal(tasks.statusCode, 200)
  assert.equal(tasks.json()[0].leadId, leadId)
  assert.equal(tasks.json()[0].isCompleted, false)
  const activity = await app.inject({ method: 'GET', url: '/api/v1/activity-feed?limit=10' })
  assert.equal(activity.statusCode, 200)
  assert.equal(activity.json()[0].description, 'Stage changed')
  const complete = await app.inject({ method: 'POST', url: `/api/v1/leads/${leadId}/tasks/${taskId}/complete` })
  assert.equal(complete.statusCode, 204)
  assert.ok(calls.some((call) => call.path.includes(`lead_tasks?id=eq.${taskId}`) && JSON.parse(call.init.body).is_done === true))
  await app.close()
})
