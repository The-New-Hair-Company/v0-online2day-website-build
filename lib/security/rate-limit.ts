import { createHmac } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin-client'

export type RateLimitResult = {
  ok: boolean
  remaining: number
  resetAt: number
  unavailable?: boolean
}

export function getClientIp(request: Request) {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip') || 'unknown'
}

function privateBucketKey(key: string) {
  const secret =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.O2D_DB_SUPABASE_SECRET_KEY ||
    process.env.O2D_DB_SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('A Supabase server key is required for distributed rate limiting')
  return `v1:${createHmac('sha256', secret).update(key).digest('hex')}`
}

export async function enforceRateLimit(input: {
  key: string
  limit: number
  windowMs: number
}): Promise<RateLimitResult> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('consume_api_rate_limit', {
      p_bucket_key: privateBucketKey(input.key),
      p_limit: input.limit,
      p_window_ms: input.windowMs,
    })
    if (error) throw error

    const row = Array.isArray(data) ? data[0] : data
    const resetAt = Date.parse(String(row?.reset_at || ''))
    if (!row || !Number.isFinite(resetAt)) throw new Error('Invalid rate-limit response')

    return {
      ok: Boolean(row.allowed),
      remaining: Math.max(0, Number(row.remaining) || 0),
      resetAt,
    }
  } catch (error) {
    console.error('Distributed rate limiter unavailable', error instanceof Error ? error.message : 'Unknown error')
    return {
      ok: false,
      remaining: 0,
      resetAt: Date.now() + 1_000,
      unavailable: true,
    }
  }
}

export function rateLimitHeaders(result: RateLimitResult, limit: number) {
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
  const headers: Record<string, string> = {
    'RateLimit-Limit': String(limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(retryAfter),
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  }
  if (!result.ok) headers['Retry-After'] = String(retryAfter)
  return headers
}
