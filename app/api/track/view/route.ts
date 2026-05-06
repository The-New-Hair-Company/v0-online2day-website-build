import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { recordSecurityEvent } from '@/lib/security/security-events'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const rate = enforceRateLimit({
      key: `track-view:${ip}`,
      limit: 60,
      windowMs: 60_000,
    })
    if (!rate.ok) {
      await recordSecurityEvent({ type: 'rate_limit', route: '/api/track/view', ip, detail: 'Rate limit exceeded' })
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { leadId } = await request.json()
    
    if (!leadId || typeof leadId !== 'string' || !UUID_RE.test(leadId)) {
      await recordSecurityEvent({ type: 'invalid_uuid', route: '/api/track/view', ip, detail: `leadId=${String(leadId)}` })
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase.from('lead_events').insert({
      lead_id: leadId,
      type: 'Video View',
      note: 'Client viewed the personalized video page',
    })

    if (error) {
      console.error('Error logging video view:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { success: true },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-RateLimit-Remaining': String(rate.remaining),
        },
      },
    )
  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
