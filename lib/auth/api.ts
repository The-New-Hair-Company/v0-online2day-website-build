import { NextResponse } from 'next/server'
import { enforceRateLimit, getClientIp } from '@/lib/security/rate-limit'

export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

export function enforceAuthRateLimit(
  request: Request,
  action: string,
  limit: number,
) {
  return enforceRateLimit({
    key: `auth:${action}:${getClientIp(request)}`,
    limit,
    windowMs: 15 * 60 * 1000,
  })
}

export function authJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export function authRedirectUrl(request: Request, next = '/protected') {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  const origin = configured || new URL(request.url).origin
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`
}
