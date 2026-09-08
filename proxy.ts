import { updateSession } from '@/lib/supabase/proxy'
import { hasValidCloudflareOriginSecret } from '@/lib/security/proxy-trust'
import { NextResponse, type NextRequest } from 'next/server'

function requiresSessionUpdate(pathname: string) {
  return (
    pathname === '/auth/callback' ||
    pathname === '/protected' ||
    pathname.startsWith('/protected/') ||
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/user-dashboard' ||
    pathname.startsWith('/user-dashboard/')
  )
}

export async function proxy(request: NextRequest) {
  if (!hasValidCloudflareOriginSecret(request.headers)) {
    return new NextResponse(null, {
      status: 404,
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  }

  if (requiresSessionUpdate(request.nextUrl.pathname)) {
    return await updateSession(request)
  }

  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|ttf|css|js|map)$).*)',
  ],
}
