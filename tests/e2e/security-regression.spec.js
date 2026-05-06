import { test, expect } from '@playwright/test'

test.describe('Security regression checks', () => {
  test('track view rejects invalid UUID payload', async ({ request }) => {
    const res = await request.post('/api/track/view', {
      data: { leadId: 'not-a-uuid' },
    })
    expect(res.status()).toBe(400)
  })

  test('download agreements rejects missing ids', async ({ request }) => {
    const res = await request.get('/api/download-agreements')
    expect([400, 401]).toContain(res.status())
  })

  test('download agreements route enforces throttling under burst traffic', async ({ request }) => {
    const responses = await Promise.all(
      Array.from({ length: 30 }).map(() =>
        request.get('/api/download-agreements?ids=not-a-uuid'),
      ),
    )
    const statuses = responses.map((res) => res.status())
    expect(statuses.some((status) => status === 429)).toBeTruthy()
  })
})
