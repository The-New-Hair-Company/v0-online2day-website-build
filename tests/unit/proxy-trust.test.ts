import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CLOUDFLARE_ORIGIN_HEADER,
  getTrustedClientIp,
  hasValidCloudflareOriginSecret,
} from '../../lib/security/proxy-trust.ts'

test('origin guard is inert until a production secret is configured', () => {
  assert.equal(hasValidCloudflareOriginSecret(new Headers(), undefined), true)
})

test('origin guard rejects absent and incorrect edge credentials', () => {
  const missing = new Headers()
  const incorrect = new Headers({ [CLOUDFLARE_ORIGIN_HEADER]: 'incorrect' })

  assert.equal(hasValidCloudflareOriginSecret(missing, 'expected'), false)
  assert.equal(hasValidCloudflareOriginSecret(incorrect, 'expected'), false)
})

test('origin guard accepts an exact edge credential', () => {
  const headers = new Headers({ [CLOUDFLARE_ORIGIN_HEADER]: 'expected' })
  assert.equal(hasValidCloudflareOriginSecret(headers, 'expected'), true)
})

test('trusts Cloudflare client IP only on an authenticated edge request', () => {
  const headers = new Headers({
    [CLOUDFLARE_ORIGIN_HEADER]: 'expected',
    'cf-connecting-ip': '203.0.113.42',
    'x-vercel-forwarded-for': '198.51.100.10',
  })

  assert.equal(getTrustedClientIp(headers, 'expected'), '203.0.113.42')
  assert.equal(getTrustedClientIp(headers, 'different'), '198.51.100.10')
})

test('ignores malformed forwarded IP values', () => {
  const headers = new Headers({
    'x-vercel-forwarded-for': 'not-an-ip',
    'x-real-ip': '2001:db8::1',
  })

  assert.equal(getTrustedClientIp(headers, undefined), '2001:db8::1')
})
