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
  response.headers.set('X-Request-Id', requestId)
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

/**
 * Security headers for HubSpot embed routes — allows iframe from HubSpot domains.
 */
function addEmbedHeaders(response: NextResponse, requestId: string): NextResponse {
  response.headers.set('X-Request-Id', requestId)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  // Allow HubSpot to iframe this page
  response.headers.delete('X-Frame-Options')
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors https://*.hubspot.com https://*.hubspotusercontent.com"
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

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value

  // Public auth routes — no session required
  const isPublicAuthRoute =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/api/auth/register') ||
    pathname.startsWith('/api/auth/otp') ||
    pathname.startsWith('/api/auth/hubspot') ||
    pathname.startsWith('/api/auth/callback') ||
    pathname.startsWith('/api/auth/logout')

  if (isPublicAuthRoute) {
    return addSecurityHeaders(NextResponse.next(), requestId)
  }

  // HubSpot embed routes — token-based auth handled by the routes themselves
  const isHubSpotEmbedRoute =
    pathname.startsWith('/api/hubspot/') ||
    pathname === '/hubspot-embed'

  if (isHubSpotEmbedRoute) {
    return addEmbedHeaders(NextResponse.next(), requestId)
  }

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

  // Also check for Bearer token (used by HubSpot embed iframe for /api/chat)
  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const tokenToVerify = sessionToken || bearerToken

  if (!tokenToVerify) {
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
    const { payload } = await jwtVerify(tokenToVerify, secret)
    const userId = payload.userId as string

    if (!userId) {
      throw new Error('Invalid session')
    }

    // Use embed headers for API requests from the HubSpot iframe
    const headerFn = bearerToken ? addEmbedHeaders : addSecurityHeaders
    const response = headerFn(NextResponse.next(), requestId)
    response.headers.set('x-user-id', userId)
    response.headers.set('x-request-id', requestId)
    return response
  } catch {
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
    '/hubspot-embed',
    '/api/chat/:path*',
    '/api/mcp/:path*',
    '/api/admin/:path*',
    '/api/auth/:path*',
    '/api/hubspot/:path*',
    '/login',
    '/register',
    '/',
  ],
}
