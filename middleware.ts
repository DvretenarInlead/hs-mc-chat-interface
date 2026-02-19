import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SESSION_COOKIE_NAME = 'ri_session'

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) return null
  return new TextEncoder().encode(secret)
}

function generateRequestId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `${timestamp}-${random}`
}

function addSecurityHeaders(response: NextResponse, requestId: string): NextResponse {
  // Request tracing
  response.headers.set('X-Request-Id', requestId)

  // Security headers
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

function getAppBaseUrl(request: NextRequest): string {
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (host && !host.includes('0.0.0.0')) {
    return `${proto}://${host}`
  }
  return new URL(request.url).origin
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const requestId = generateRequestId()

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
    return addSecurityHeaders(NextResponse.next(), requestId)
  }

  if (!sessionToken) {
    if (pathname.startsWith('/api/')) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        requestId
      )
    }
    const baseUrl = getAppBaseUrl(request)
    return NextResponse.redirect(new URL('/login', baseUrl))
  }

  // Verify the JWT
  const secret = getSessionSecret()
  if (!secret) {
    return addSecurityHeaders(
      NextResponse.json({ error: 'Server configuration error' }, { status: 500 }),
      requestId
    )
  }

  try {
    const { payload } = await jwtVerify(sessionToken, secret)
    const userId = payload.userId as string

    if (!userId) {
      throw new Error('Invalid session')
    }

    // Attach userId and requestId to request headers for downstream use
    const response = addSecurityHeaders(NextResponse.next(), requestId)
    response.headers.set('x-user-id', userId)
    response.headers.set('x-request-id', requestId)
    return response
  } catch {
    // Invalid or expired token
    if (pathname.startsWith('/api/')) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Session expired' }, { status: 401 }),
        requestId
      )
    }
    const baseUrl = getAppBaseUrl(request)
    return NextResponse.redirect(new URL('/login', baseUrl))
  }
}

export const config = {
  matcher: [
    '/chat/:path*',
    '/admin/:path*',
    '/api/chat/:path*',
    '/api/mcp/:path*',
    '/api/admin/:path*',
    '/login',
    '/',
  ],
}
