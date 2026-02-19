import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SESSION_COOKIE_NAME = 'ri_session'

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) return null
  return new TextEncoder().encode(secret)
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'"
  )
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check for session cookie
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value

  // Routes that require authentication
  const isProtectedRoute =
    pathname.startsWith('/chat') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/chat') ||
    pathname.startsWith('/api/mcp') ||
    pathname.startsWith('/api/admin')

  if (!isProtectedRoute) {
    return addSecurityHeaders(NextResponse.next())
  }

  if (!sessionToken) {
    if (pathname.startsWith('/api/')) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Verify the JWT
  const secret = getSessionSecret()
  if (!secret) {
    return addSecurityHeaders(
      NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    )
  }

  try {
    const { payload } = await jwtVerify(sessionToken, secret)
    const userId = payload.userId as string

    if (!userId) {
      throw new Error('Invalid session')
    }

    // Attach userId to request headers for downstream use
    const response = addSecurityHeaders(NextResponse.next())
    response.headers.set('x-user-id', userId)
    return response
  } catch {
    // Invalid or expired token
    if (pathname.startsWith('/api/')) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Session expired' }, { status: 401 })
      )
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: [
    '/chat/:path*',
    '/admin/:path*',
    '/api/chat',
    '/api/mcp/:path*',
    '/api/admin/:path*',
    '/login',
    '/',
  ],
}
