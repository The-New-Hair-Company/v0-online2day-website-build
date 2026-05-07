import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // `next` may be set by magic-link / password-reset emails — only honour it
  // after verifying the user has permission to reach that destination.
  const requestedNext = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: isAdmin } = await supabase.rpc('is_admin')

        if (isAdmin) {
          const dest = requestedNext?.startsWith('/dashboard') ? requestedNext : '/dashboard'
          return NextResponse.redirect(`${origin}${dest}`)
        } else {
          const dest = requestedNext?.startsWith('/user-dashboard') ? requestedNext : '/user-dashboard'
          return NextResponse.redirect(`${origin}${dest}`)
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=Invalid+or+expired+link`)
}
