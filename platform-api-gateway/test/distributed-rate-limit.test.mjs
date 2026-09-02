import assert from 'node:assert/strict'
import test from 'node:test'
import { createDistributedRateLimitStore, rateLimitIdentity } from '../dist/distributed-rate-limit.js'

test('distributed rate limiter hashes credentials and returns shared counter state', async () => {
  const calls = []
  const Store = createDistributedRateLimitStore(async (keyHash, windowMs) => {
    calls.push({ keyHash, windowMs })
    return { current: 3, ttl: 12_500 }
  })
  const store = new Store({ groupId: 'authenticated' })
  const result = await new Promise((resolve, reject) => store.incr(rateLimitIdentity('127.0.0.1', 'Bearer secret-token'), (error, value) => error ? reject(error) : resolve(value), 30_000))
  assert.deepEqual(result, { current: 3, ttl: 12_500 })
  assert.match(calls[0].keyHash, /^[a-f0-9]{64}$/)
  assert.equal(JSON.stringify(calls).includes('secret-token'), false)
  assert.equal(calls[0].windowMs, 30_000)
  assert.notEqual(rateLimitIdentity('127.0.0.1'), rateLimitIdentity('127.0.0.2'))
})
