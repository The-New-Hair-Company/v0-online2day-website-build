import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { authJson, enforceAuthRateLimit, isSameOrigin } from '@/lib/auth/api'

const updateSchema = z.object({ password: z.string().min(8).max(128) })

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return authJson({ error: 'Invalid request origin.' }, 403)
  if (!enforceAuthRateLimit(request, 'password-reset-update', 5).ok) {
    return authJson({ error: 'Too many password update attempts. Please try again later.' }, 429)
  }

  const input = updateSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return authJson({ error: 'Use a password of at least 8 characters.' }, 400)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return authJson({ error: 'This reset link is invalid or expired. Request a new one.' }, 401)

  const { error } = await supabase.auth.updateUser({ password: input.data.password })
  if (error) {
    console.error('Supabase password update failed', { code: error.code, status: error.status })
    return authJson({ error: 'The password could not be updated. Request a new reset link.' }, 400)
  }

  return authJson({ ok: true })
}
