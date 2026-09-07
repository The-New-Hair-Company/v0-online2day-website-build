import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { platformServerFetch } from '@/lib/api/platform-server'

export const runtime = 'nodejs'

type ResendEmailEvent = {
  type: string
  created_at?: string
  data?: { email_id?: string; message_id?: string }
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

  const payload = await request.text()
  let event: ResendEmailEvent
  try {
    // Signature verification is entirely local and only needs the webhook
    // signing secret. Delivery credentials intentionally live in Azure.
    const resend = new Resend('webhook-verification-only')
    event = resend.webhooks.verify({
      payload,
      headers: { id: eventId, timestamp, signature },
      webhookSecret,
    }) as ResendEmailEvent
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 })
  }

  if (!event.type.startsWith('email.') || !event.data?.email_id) {
    return NextResponse.json({ accepted: true, ignored: true })
  }

  const path = event.type === 'email.received'
    ? '/api/v1/online2day/inbound-email-events'
    : '/api/v1/online2day/email-events'
  try {
    await platformServerFetch(path, {
      method: 'POST',
      serviceRequest: true,
      body: JSON.stringify({
        eventId,
        emailId: event.data.email_id,
        messageId: event.data.message_id,
        ...(event.type === 'email.received' ? {} : { eventType: event.type }),
        createdAt: event.created_at,
      }),
    })
    return NextResponse.json({ accepted: true })
  } catch (error) {
    console.error('Verified Resend webhook could not be persisted.', {
      eventId,
      eventType: event.type,
      providerEmailId: event.data.email_id,
      error: error instanceof Error ? error.message : 'Unknown upstream failure',
    })
    // Resend retries non-2xx responses. A verified event must never be discarded
    // as a signature error merely because the durable API is temporarily down.
    return NextResponse.json({ error: 'Webhook processing is temporarily unavailable.' }, {
      status: 503,
      headers: { 'Retry-After': '30' },
    })
  }
}
