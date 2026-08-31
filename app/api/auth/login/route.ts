import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { authJson, enforceAuthRateLimit, isSameOrigin } from '@/lib/auth/api'

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
})

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return authJson({ error: 'Invalid request origin.' }, 403)
  if (!enforceAuthRateLimit(request, 'login', 10).ok) {
    return authJson({ error: 'Too many login attempts. Please try again later.' }, 429)
  }

  const input = loginSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return authJson({ error: 'Enter a valid email and password.' }, 400)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: input.data.email.toLowerCase(),
    password: input.data.password,
  })

  if (error) {
    console.warn('Supabase login rejected', { code: error.code, status: error.status })
    return authJson({ error: 'Invalid email or password, or the email is not confirmed.' }, 401)
  }

  return authJson({ ok: true })
}
