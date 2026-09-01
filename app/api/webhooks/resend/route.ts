import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { platformServerFetch } from '@/lib/api/platform-server'

export const runtime = 'nodejs'

type ResendEmailEvent = {
  type: string
  created_at?: string
  data?: { email_id?: string }
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Email webhook is not configured.' }, { status: 503 })
  }

  const eventId = request.headers.get('svix-id')
  const timestamp = request.headers.get('svix-timestamp')
  const signature = request.headers.get('svix-signature')
  if (!eventId || !timestamp || !signature) {
    return NextResponse.json({ error: 'Missing webhook signature.' }, { status: 400 })
  }

  try {
    const payload = await request.text()
    // Signature verification is entirely local and only needs the webhook
    // signing secret. Delivery credentials intentionally live in Azure.
    const resend = new Resend('webhook-verification-only')
    const event = resend.webhooks.verify({
      payload,
      headers: { id: eventId, timestamp, signature },
      webhookSecret,
    }) as ResendEmailEvent

    if (!event.type.startsWith('email.') || !event.data?.email_id) {
      return NextResponse.json({ accepted: true, ignored: true })
    }

    await platformServerFetch('/api/v1/online2day/email-events', {
      method: 'POST',
      serviceRequest: true,
      body: JSON.stringify({
        eventId,
        emailId: event.data.email_id,
        eventType: event.type,
        createdAt: event.created_at,
      }),
    })
    return NextResponse.json({ accepted: true })
  } catch {
    return NextResponse.json({ error: 'Invalid webhook.' }, { status: 400 })
  }
}
