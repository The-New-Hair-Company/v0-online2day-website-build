import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { platformServerFetch } from '@/lib/api/platform-server'

export const runtime = 'nodejs'

const COOKIE = 'o2d_chat_session'
const COOKIE_AGE = 30 * 24 * 60 * 60

function sessionToken(request: NextRequest) {
  return request.cookies.get(COOKIE)?.value || ''
}
function responseWithSession<T>(body: T, token?: string, status = 200) {
  const response = NextResponse.json(body, { status })
  if (token) {
    response.cookies.set(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_AGE,
    })
  }
  return response
}

export async function GET(request: NextRequest) {
  const token = sessionToken(request)
  if (!token) return NextResponse.json({ active: false, messages: [] })
  try {
    const result = await platformServerFetch<{ conversationId: string; messages: unknown[] }>(
      '/api/v1/online2day/public-chat/messages/list',
      { method: 'POST', serviceRequest: true, body: JSON.stringify({ token }) },
    )
    return NextResponse.json({ active: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/not found|expired/i.test(message)) {
      const response = NextResponse.json({ active: false, messages: [] })
      response.cookies.delete(COOKIE)
      return response
    }
    return NextResponse.json({ error: 'Chat is temporarily unavailable.' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null)
  const action = z.discriminatedUnion('action', [
    z.object({ action: z.literal('start'), name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254).optional(), topic: z.string().trim().min(1).max(120).optional() }),
    z.object({ action: z.literal('send'), content: z.string().trim().min(1).max(5_000) }),
  ]).safeParse(payload)
  if (!action.success) return NextResponse.json({ error: action.error.issues[0]?.message || 'Invalid chat request.' }, { status: 400 })

  try {
    if (action.data.action === 'start') {
      const token = sessionToken(request) || randomBytes(32).toString('base64url')
      const result = await platformServerFetch<{ conversationId: string; resumed: boolean }>(
        '/api/v1/online2day/public-chat/session',
        { method: 'POST', serviceRequest: true, body: JSON.stringify({ token, name: action.data.name, email: action.data.email, topic: action.data.topic }) },
      )
      return responseWithSession({ active: true, ...result }, token, result.resumed ? 200 : 201)
    }

    const token = sessionToken(request)
    if (!token) return NextResponse.json({ error: 'Start a conversation before sending a message.' }, { status: 409 })
    const message = await platformServerFetch('/api/v1/online2day/public-chat/messages', {
      method: 'POST', serviceRequest: true, body: JSON.stringify({ token, content: action.data.content }),
    })
    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Chat is temporarily unavailable.' }, { status: 502 })
  }
}
