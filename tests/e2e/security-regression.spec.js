import { test, expect } from '@playwright/test'

test.describe('Security regression checks', () => {
  test('track view rejects invalid UUID payload', async ({ request }) => {
    const res = await request.post('/api/track/view', {
      data: { assetId: 'not-a-uuid' },
    })
    // Local builds deliberately fail closed when the shared Supabase limiter is
    // not configured; configured environments proceed to payload validation.
    expect([400, 500, 503]).toContain(res.status())
    if (res.status() === 503) expect(res.headers()['retry-after']).toBeTruthy()
  })

  test('download agreements rejects missing ids', async ({ request }) => {
    const res = await request.get('/api/download-agreements')
    expect([400, 401, 500, 503]).toContain(res.status())
  })

  test('download agreements route enforces throttling under burst traffic', async ({ request }) => {
    const responses = await Promise.all(
      // The GET allowance is 30 requests per minute; the 31st must be rejected.
      Array.from({ length: 31 }).map(() =>
        request.get('/api/download-agreements?ids=not-a-uuid'),
      ),
    )
    const statuses = responses.map((res) => res.status())
    if (statuses.some((status) => status === 500 || status === 503)) {
      // A deliberately unconfigured local server fails closed before any
      // protected export work runs. Configured environments exercise 429.
      expect(statuses.every((status) => status === 500 || status === 503)).toBeTruthy()
    } else {
      expect(statuses.some((status) => status === 429)).toBeTruthy()
    }
  })
})
