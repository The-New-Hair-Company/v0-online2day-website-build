import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // Build a mutable response so session cookies can be refreshed
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

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
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Always call getUser() — refreshes the session JWT if needed
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Admin dashboard guard (/dashboard/*) ──────────────────────────────────
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      const url = new URL('/auth/login', request.url)
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    // Check admin role via the DB function — single fast indexed lookup
    const { data: isAdmin, error } = await supabase.rpc('is_admin')

    if (error || !isAdmin) {
      // Authenticated but not admin — send to their own portal, not login
      return NextResponse.redirect(new URL('/user-dashboard', request.url))
    }
  }

  // ── User dashboard guard (/user-dashboard/*) ──────────────────────────────
  if (pathname.startsWith('/user-dashboard')) {
    if (!user) {
      const url = new URL('/auth/login', request.url)
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/user-dashboard/:path*',
  ],
}
