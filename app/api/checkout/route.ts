import { NextResponse } from 'next/server'
import { z } from 'zod'
import { enforceRateLimit, getClientIp, rateLimitHeaders } from '@/lib/security/rate-limit'

const checkoutSchema = z.object({
  plan: z.enum(['launch', 'growth']),
  billing: z.enum(['monthly', 'annual']),
})

const checkoutResponseSchema = z.object({
  id: z.string().min(1),
  url: z.string().url().refine((value) => {
    try {
      return new URL(value).hostname === 'checkout.stripe.com'
    } catch {
      return false
    }
  }),
})

function getCompanyPlatformApiUrl() {
  const value = process.env.COMPANY_PLATFORM_API_URL || process.env.DOTNET_API_URL
  if (!value) return null

  try {
    const url = new URL(value)
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
}

function getIdempotencyKey(request: Request) {
  const supplied = request.headers.get('idempotency-key')
  if (supplied && /^[A-Za-z0-9._:-]{8,200}$/.test(supplied)) return supplied
  return `online2day-${crypto.randomUUID()}`
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const ip = getClientIp(request)
  const limit = await enforceRateLimit({ key: `expensive:checkout:${ip}`, limit: 10, windowMs: 10 * 60 * 1000 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: limit.unavailable ? 'Request protection is temporarily unavailable. Please try again.' : 'Too many checkout attempts. Please try again later.' },
      { status: limit.unavailable ? 503 : 429, headers: rateLimitHeaders(limit, 10) },
    )
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const parsed = checkoutSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Unknown package selection.' }, { status: 400 })
  }

  const apiUrl = getCompanyPlatformApiUrl()
  if (!apiUrl) {
    return NextResponse.json({ error: 'Checkout is temporarily unavailable. Please use the project brief instead.' }, { status: 503 })
  }

  let apiResponse: Response
  try {
    apiResponse = await fetch(new URL('/api/v1/billing/public-checkout-sessions', apiUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': getIdempotencyKey(request),
      },
      body: JSON.stringify({
        plan: parsed.data.plan,
        billingPeriod: parsed.data.billing,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
  } catch (error) {
    console.error('Company Platform checkout request failed', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Checkout is temporarily unavailable. Please try again.' }, { status: 502 })
  }

  const responseBody: unknown = await apiResponse.json().catch(() => null)
  const session = checkoutResponseSchema.safeParse(responseBody)
  if (!apiResponse.ok || !session.success) {
    console.error('Company Platform checkout returned an invalid response', {
      status: apiResponse.status,
      responseValid: session.success,
    })
    return NextResponse.json({ error: 'Checkout is temporarily unavailable. Please try again.' }, { status: 502 })
  }

  return NextResponse.json({ url: session.data.url }, { status: 201 })
}
