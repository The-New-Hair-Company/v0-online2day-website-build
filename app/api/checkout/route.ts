import { NextResponse } from 'next/server'
import { z } from 'zod'
import { enforceRateLimit, getClientIp } from '@/lib/security/rate-limit'

const checkoutSchema = z.object({
  plan: z.enum(['launch', 'growth']),
  billing: z.enum(['monthly', 'annual']),
})

const priceEnvironmentKeys = {
  launch: {
    monthly: 'STRIPE_PRICE_LAUNCH_MONTHLY',
    annual: 'STRIPE_PRICE_LAUNCH_ANNUAL',
    setup: 'STRIPE_PRICE_LAUNCH_SETUP',
  },
  growth: {
    monthly: 'STRIPE_PRICE_GROWTH_MONTHLY',
    annual: 'STRIPE_PRICE_GROWTH_ANNUAL',
    setup: 'STRIPE_PRICE_GROWTH_SETUP',
  },
} as const

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
  const limit = enforceRateLimit({ key: `checkout:${ip}`, limit: 10, windowMs: 10 * 60 * 1000 })
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many checkout attempts. Please try again later.' }, { status: 429 })
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

  const secretKey = process.env.STRIPE_SECRET_KEY
  const keys = priceEnvironmentKeys[parsed.data.plan]
  const recurringPrice = process.env[keys[parsed.data.billing]]
  const setupPrice = process.env[keys.setup]
  if (!secretKey || !recurringPrice || !setupPrice || !recurringPrice.startsWith('price_') || !setupPrice.startsWith('price_')) {
    return NextResponse.json({ error: 'Checkout is temporarily unavailable. Please use the project brief instead.' }, { status: 503 })
  }

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  const siteUrl = configuredSiteUrl.replace(/\/$/, '')
  const body = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': recurringPrice,
    'line_items[0][quantity]': '1',
    'line_items[1][price]': setupPrice,
    'line_items[1][quantity]': '1',
    success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/pricing?checkout=cancelled`,
    billing_address_collection: 'required',
    allow_promotion_codes: 'true',
    'metadata[plan_id]': parsed.data.plan,
    'metadata[billing_period]': parsed.data.billing,
    'subscription_data[metadata][plan_id]': parsed.data.plan,
    'subscription_data[metadata][billing_period]': parsed.data.billing,
  })

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  })
  const session = await stripeResponse.json() as { url?: string }

  if (!stripeResponse.ok || !session.url?.startsWith('https://checkout.stripe.com/')) {
    return NextResponse.json({ error: 'Stripe could not start checkout. Please try again.' }, { status: 502 })
  }

  return NextResponse.json({ url: session.url }, { status: 201 })
}
