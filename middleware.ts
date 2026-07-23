import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || 
                    request.nextUrl.pathname.startsWith('/forgot-password') ||
                    request.nextUrl.pathname.startsWith('/reset-password') ||
                    request.nextUrl.pathname.startsWith('/verify-email')
  const isDashboardPage = request.nextUrl.pathname.startsWith('/dashboard')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')

  // If user is not logged in and calls protected APIs, return JSON instead of
  // redirecting to /login. Client components expect JSON from API routes; an
  // HTML login redirect can break pages during/after logout.
  if (!token && isApiRoute && !request.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, private',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    )
  }

  // If user is not logged in and trying to access protected pages
  if (!token && isDashboardPage) {
    const loginUrl = new URL('/login', request.url)
    const response = NextResponse.redirect(loginUrl)
    
    // Add cache control headers to prevent caching of protected pages
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
  }

  // If user is logged in and trying to access auth pages, redirect to dashboard
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Add security headers to all responses
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  
  // Prevent caching of protected pages
  if (isDashboardPage || (token && !isAuthPage)) {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
