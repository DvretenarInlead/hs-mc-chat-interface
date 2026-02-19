import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SESSION_COOKIE_NAME = 'ri_session'

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) return null
  return new TextEncoder().encode(secret)
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
    return NextResponse.next()
  }

  if (!sessionToken) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Verify the JWT
  const secret = getSessionSecret()
  if (!secret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const { payload } = await jwtVerify(sessionToken, secret)
    const userId = payload.userId as string

    if (!userId) {
      throw new Error('Invalid session')
    }

    // For admin routes, we need to verify role
    // This is a lightweight check; the API routes do a full DB check
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
      // The role will be verified in the actual API handler
      // Middleware just ensures a valid session exists
    }

    // Attach userId to request headers for downstream use
    const response = NextResponse.next()
    response.headers.set('x-user-id', userId)
    return response
  } catch {
    // Invalid or expired token
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
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
  ],
}
