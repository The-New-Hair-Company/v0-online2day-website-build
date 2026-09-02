import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import { verifyWhatsAppSignature } from '../../lib/webhooks/whatsapp.ts'

test('validates WhatsApp webhook signatures without accepting malformed input', () => {
  const secret = 'test-secret'
  const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
  const signature = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`
  assert.equal(verifyWhatsAppSignature(payload, signature, secret), true)
  assert.equal(verifyWhatsAppSignature(`${payload}changed`, signature, secret), false)
  assert.equal(verifyWhatsAppSignature(payload, 'sha256=short', secret), false)
  assert.equal(verifyWhatsAppSignature(payload, null, secret), false)
  assert.equal(verifyWhatsAppSignature(payload, signature, undefined), false)
})
