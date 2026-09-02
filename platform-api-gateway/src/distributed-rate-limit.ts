import { createHash } from 'node:crypto'

type RateLimitResult = { current: number; ttl: number }
type Callback = (error: Error | null, result?: RateLimitResult) => void
type CounterFetcher = (keyHash: string, windowMs: number) => Promise<RateLimitResult>

export function sharedBucketToCounter(
  row: { remaining: number; reset_at: string } | undefined,
  ceiling: number,
  nowMs = Date.now(),
): RateLimitResult {
  const resetAt = Date.parse(row?.reset_at || '')
  const remaining = Number(row?.remaining)
  if (!row || !Number.isFinite(resetAt) || !Number.isFinite(remaining)) {
    throw new Error('Invalid shared rate-limit response.')
  }
  return {
    current: Math.max(1, ceiling - Math.max(0, remaining)),
    ttl: Math.max(1, resetAt - nowMs),
  }
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function createDistributedRateLimitStore(fetchCounter: CounterFetcher) {
  return class DistributedRateLimitStore {
    private readonly scope: string

    constructor(options: { groupId?: string; nameSpace?: string } = {}) {
      this.scope = String(options.groupId || options.nameSpace || 'global')
    }

    incr(key: string, callback: Callback, timeWindow = 60_000) {
      void fetchCounter(hash(`${this.scope}:${key}`), timeWindow)
        .then((result) => callback(null, { current: Number(result.current), ttl: Math.max(1, Number(result.ttl)) }))
        .catch((error) => callback(error instanceof Error ? error : new Error('Distributed rate limit store failed.')))
    }

    child(routeOptions: { method?: unknown; url?: unknown; path?: unknown; groupId?: unknown; routeInfo?: unknown }) {
      const routeInfo = routeOptions.routeInfo && typeof routeOptions.routeInfo === 'object' ? routeOptions.routeInfo as Record<string, unknown> : {}
      const routeScope = [this.scope, routeInfo.method || routeOptions.method, routeInfo.url || routeInfo.path || routeOptions.url || routeOptions.path, routeOptions.groupId].filter(Boolean).join(':')
      return new DistributedRateLimitStore({ groupId: routeScope })
    }
  }
}

export function rateLimitIdentity(ip: string, authorization?: string) {
  return authorization?.startsWith('Bearer ') ? `principal:${hash(authorization.slice(7))}` : `ip:${ip}`
}
