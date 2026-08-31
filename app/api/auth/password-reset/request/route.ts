import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  authJson,
  authRedirectUrl,
  enforceAuthRateLimit,
  isSameOrigin,
} from '@/lib/auth/api'

const requestSchema = z.object({ email: z.string().trim().email().max(254) })

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return authJson({ error: 'Invalid request origin.' }, 403)
  if (!enforceAuthRateLimit(request, 'password-reset-request', 3).ok) {
    return authJson({ error: 'Too many reset requests. Please wait before trying again.' }, 429)
  }

  const input = requestSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return authJson({ error: 'Enter a valid email address.' }, 400)

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(input.data.email.toLowerCase(), {
    redirectTo: authRedirectUrl(request, '/auth/reset-password'),
  })

  if (error) {
    console.error('Supabase password recovery request failed', { code: error.code, status: error.status })
    const rateLimited = error.status === 429 || error.code === 'over_email_send_rate_limit'
    return authJson({
      error: rateLimited
        ? 'Password reset email limit reached. Please wait a few minutes and try again.'
        : 'The password reset email could not be sent. Please try again shortly.',
    }, rateLimited ? 429 : 503)
  }

  return authJson({ ok: true })
}
