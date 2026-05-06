import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isFoundingAdminEmail, normalizeEmail } from '@/lib/license'

const ADMIN_ONLY_PREFIXES = [
  '/dashboard/settings',
  '/dashboard/integrations',
  '/dashboard/enterprise',
  '/dashboard/reports',
]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getUser() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  async function isAdminUser() {
    if (!user) return false
    const email = normalizeEmail(user.email)
    if (isFoundingAdminEmail(email)) return true

    const [{ data: profile }, { data: licensed }] = await Promise.all([
      supabase.from('user_profiles').select('role').eq('user_id', user.id).single(),
      supabase.from('licensed_users').select('role, status').eq('email', email).single(),
    ])
    return profile?.role === 'admin' || (licensed?.role === 'admin' && licensed?.status === 'active')
  }

  if (
    // if the user is not logged in and the app path, in this case, /protected, is accessed, redirect to the login page
    request.nextUrl.pathname.startsWith('/protected') &&
    !user
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  if (user && ADMIN_ONLY_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix))) {
    const admin = await isAdminUser()
    if (!admin) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard/overview'
      url.searchParams.set('restricted', '1')
      return NextResponse.redirect(url)
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
