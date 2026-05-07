import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: Do not add any code between createServerClient and getUser().
  // getUser() refreshes the session — skipping it causes random logouts.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── /protected/* — must be authenticated ──────────────────────────────────
  if (pathname.startsWith('/protected') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // ── /dashboard/* — must be an admin ───────────────────────────────────────
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    // Single DB function call covers founding admins, user_profiles, and licensed_users
    const { data: isAdmin } = await supabase.rpc('is_admin')

    if (!isAdmin) {
      // Authenticated but not an admin — send to their portal, not the login page
      const url = request.nextUrl.clone()
      url.pathname = '/user-dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // ── /user-dashboard/* — must be authenticated ─────────────────────────────
  if (pathname.startsWith('/user-dashboard') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // IMPORTANT: Return supabaseResponse as-is so session cookies are forwarded.
  return supabaseResponse
}
