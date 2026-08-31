import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createHubSpotContactFromSignUp } from '@/app/actions/hubspot'
import {
  authJson,
  authRedirectUrl,
  enforceAuthRateLimit,
  isSameOrigin,
} from '@/lib/auth/api'

const signupSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
})

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return authJson({ error: 'Invalid request origin.' }, 403)
  if (!enforceAuthRateLimit(request, 'signup', 5).ok) {
    return authJson({ error: 'Too many signup attempts. Please try again later.' }, 429)
  }

  const input = signupSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) {
    return authJson({ error: 'Enter a valid email and a password of at least 8 characters.' }, 400)
  }

  const email = input.data.email.toLowerCase()
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.data.password,
    options: { emailRedirectTo: authRedirectUrl(request) },
  })

  if (error) {
    console.error('Supabase signup failed', { code: error.code, status: error.status })
    const rateLimited = error.status === 429 || error.code === 'over_email_send_rate_limit'
    return authJson({
      error: rateLimited
        ? 'Confirmation email limit reached. Please wait a few minutes and try again.'
        : 'We could not create the account or send its confirmation email. Please try again.',
    }, rateLimited ? 429 : 503)
  }

  // Supabase intentionally returns an obfuscated user with no identities when
  // the address already exists. Do not create duplicate CRM activity in that case.
  if (data.user?.identities?.length) {
    await Promise.allSettled([createHubSpotContactFromSignUp({ email })])
  }
  return authJson({ ok: true }, 201)
}
