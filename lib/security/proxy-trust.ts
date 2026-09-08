import { timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'

export const CLOUDFLARE_ORIGIN_HEADER = 'x-online2day-edge-key'

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function hasValidCloudflareOriginSecret(
  headers: Headers,
  expectedSecret = process.env.CLOUDFLARE_ORIGIN_SECRET?.trim(),
) {
  if (!expectedSecret) return true

  const providedSecret = headers.get(CLOUDFLARE_ORIGIN_HEADER)?.trim()
  return Boolean(providedSecret && constantTimeEqual(providedSecret, expectedSecret))
}

function firstValidIp(value: string | null) {
  if (!value) return null

  for (const candidate of value.split(',')) {
    const ip = candidate.trim()
    if (isIP(ip)) return ip
  }

  return null
}

export function getTrustedClientIp(
  headers: Headers,
  expectedSecret = process.env.CLOUDFLARE_ORIGIN_SECRET?.trim(),
) {
  // Cloudflare overwrites CF-Connecting-IP at its edge. Only trust it when the
  // shared origin header proves the request actually traversed that edge.
  if (expectedSecret && hasValidCloudflareOriginSecret(headers, expectedSecret)) {
    const cloudflareIp = firstValidIp(headers.get('cf-connecting-ip'))
    if (cloudflareIp) return cloudflareIp
  }

  // Vercel generates this header and protects it from client XFF spoofing.
  return (
    firstValidIp(headers.get('x-vercel-forwarded-for')) ||
    firstValidIp(headers.get('x-real-ip')) ||
    firstValidIp(headers.get('x-forwarded-for')) ||
    'unknown'
  )
}
