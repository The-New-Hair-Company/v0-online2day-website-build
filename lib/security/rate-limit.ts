type Bucket = {
  count: number
  resetAt: number
}

const STORE_KEY = '__o2d_rate_limit_store__'

function getStore() {
  const g = globalThis as unknown as Record<string, Map<string, Bucket> | undefined>
  if (!g[STORE_KEY]) g[STORE_KEY] = new Map<string, Bucket>()
  return g[STORE_KEY] as Map<string, Bucket>
}

export function getClientIp(request: Request) {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip') || 'unknown'
}

export function enforceRateLimit(input: {
  key: string
  limit: number
  windowMs: number
}) {
  const now = Date.now()
  const store = getStore()
  const bucket = store.get(input.key)

  if (!bucket || now >= bucket.resetAt) {
    store.set(input.key, { count: 1, resetAt: now + input.windowMs })
    return { ok: true as const, remaining: input.limit - 1, resetAt: now + input.windowMs }
  }

  if (bucket.count >= input.limit) {
    return { ok: false as const, remaining: 0, resetAt: bucket.resetAt }
  }

  bucket.count += 1
  store.set(input.key, bucket)
  return { ok: true as const, remaining: input.limit - bucket.count, resetAt: bucket.resetAt }
}
