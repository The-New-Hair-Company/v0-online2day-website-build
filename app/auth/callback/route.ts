import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Use the actual request origin instead of environment variables
      // This ensures we always redirect back to the domain the user is on (e.g. https://www.online2day.com)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // If there's an error or no code, redirect to an error page or login
  return NextResponse.redirect(`${origin}/auth/login?error=Invalid+or+expired+link`)
}
