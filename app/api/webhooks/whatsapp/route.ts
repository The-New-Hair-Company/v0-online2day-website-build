import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { platformServerFetch } from '@/lib/api/platform-server'
import { verifyWhatsAppSignature } from '@/lib/webhooks/whatsapp'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')
  if (!verifyToken || mode !== 'subscribe' || token !== verifyToken || !challenge) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
}

export async function POST(request: NextRequest) {
  const secret = process.env.WHATSAPP_APP_SECRET
  const signature = request.headers.get('x-hub-signature-256')
  if (!secret || !signature?.startsWith('sha256=')) {
    return NextResponse.json({ error: 'WhatsApp webhook is not configured.' }, { status: 503 })
  }
  const payload = await request.text()
  if (!verifyWhatsAppSignature(payload, signature, secret)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
  }
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>
    const eventId = createHash('sha256').update(payload).digest('hex')
    await platformServerFetch('/api/v1/online2day/whatsapp/inbound', {
      method: 'POST', serviceRequest: true, body: JSON.stringify({ eventId, payload: parsed }),
    })
    return NextResponse.json({ accepted: true })
  } catch {
    return NextResponse.json({ error: 'Invalid WhatsApp webhook.' }, { status: 400 })
  }
}
