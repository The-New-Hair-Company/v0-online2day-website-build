import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  authJson,
  authRedirectUrl,
  enforceAuthRateLimit,
  isSameOrigin,
} from '@/lib/auth/api'

const resendSchema = z.object({ email: z.string().trim().email().max(254) })

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return authJson({ error: 'Invalid request origin.' }, 403)
  if (!enforceAuthRateLimit(request, 'resend-confirmation', 3).ok) {
    return authJson({ error: 'Too many email requests. Please wait before trying again.' }, 429)
  }

  const input = resendSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return authJson({ error: 'Enter a valid email address.' }, 400)

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: input.data.email.toLowerCase(),
    options: { emailRedirectTo: authRedirectUrl(request) },
  })

  if (error) {
    console.error('Supabase confirmation resend failed', { code: error.code, status: error.status })
    const rateLimited = error.status === 429 || error.code === 'over_email_send_rate_limit'
    return authJson({
      error: rateLimited
        ? 'Confirmation email limit reached. Please wait a few minutes and try again.'
        : 'The confirmation email could not be sent. Please try again shortly.',
    }, rateLimited ? 429 : 503)
  }

  return authJson({ ok: true })
}
