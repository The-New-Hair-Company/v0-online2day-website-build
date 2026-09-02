import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyWhatsAppSignature(payload: string, signature: string | null, secret: string | undefined) {
  if (!secret || !signature?.startsWith('sha256=')) return false
  const supplied = Buffer.from(signature)
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
