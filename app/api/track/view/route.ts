import { NextResponse } from 'next/server'
import { enforceRateLimit, getClientIp, rateLimitHeaders } from '@/lib/security/rate-limit'
import { recordSecurityEvent } from '@/lib/security/security-events'
import { platformServerFetch } from '@/lib/api/platform-server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const rate = await enforceRateLimit({
      key: `anonymous:track-view:${ip}`,
      limit: 60,
      windowMs: 60_000,
    })
    if (!rate.ok) {
      await recordSecurityEvent({ type: 'rate_limit', route: '/api/track/view', ip, detail: 'Rate limit exceeded' })
      return NextResponse.json(
        { error: rate.unavailable ? 'Request protection is temporarily unavailable. Please try again.' : 'Too many requests' },
        { status: rate.unavailable ? 503 : 429, headers: rateLimitHeaders(rate, 60) },
      )
    }

    const { assetId } = await request.json()
    
    if (!assetId || typeof assetId !== 'string' || !UUID_RE.test(assetId)) {
      await recordSecurityEvent({ type: 'invalid_uuid', route: '/api/track/view', ip, detail: `assetId=${String(assetId)}` })
      return NextResponse.json({ error: 'Missing assetId' }, { status: 400 })
    }

    await platformServerFetch(`/api/v1/online2day/video-assets/${assetId}/view`, {
      method: 'POST', serviceRequest: true, body: '{}',
    })

    return NextResponse.json(
      { success: true },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          ...rateLimitHeaders(rate, 60),
        },
      },
    )
  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
