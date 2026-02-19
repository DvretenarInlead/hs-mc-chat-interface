import { NextRequest, NextResponse } from 'next/server'
import {
  exchangeCodeForTokens,
  getUserFromToken,
} from '@/lib/auth/hubspot-oauth'
import { encrypt } from '@/lib/auth/encryption'
import { createSession, setSessionCookie } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

function getAppBaseUrl(request: NextRequest): string {
  // Prefer NEXTAUTH_URL to avoid Docker internal 0.0.0.0:8080 URLs
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  // Fallback: try to reconstruct from forwarded headers (reverse proxy)
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (host && !host.includes('0.0.0.0')) {
    return `${proto}://${host}`
  }
  // Last resort: use request.url
  return new URL(request.url).origin
}

function redirectWithCleanup(request: NextRequest, path: string): NextResponse {
  const baseUrl = getAppBaseUrl(request)
  const response = NextResponse.redirect(new URL(path, baseUrl))
  response.cookies.delete('hubspot_oauth_state')
  return response
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Check for OAuth errors
  if (error) {
    console.error('HubSpot OAuth error:', error)
    return redirectWithCleanup(request, '/login?error=oauth_error')
  }

  if (!code) {
    return redirectWithCleanup(request, '/login?error=no_code')
  }

  // Verify CSRF state
  const storedState = request.cookies.get('hubspot_oauth_state')?.value
  if (!state || !storedState || state !== storedState) {
    return redirectWithCleanup(request, '/login?error=invalid_state')
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    // Get user identity from HubSpot
    const hubspotUser = await getUserFromToken(tokens.access_token)

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Create or update user in database
    const user = await prisma.user.upsert({
      where: { hubspotUserId: String(hubspotUser.user_id) },
      update: {
        email: hubspotUser.user,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiresAt,
        hubspotPortalId: String(hubspotUser.hub_id),
      },
      create: {
        hubspotUserId: String(hubspotUser.user_id),
        email: hubspotUser.user,
        name: hubspotUser.user.split('@')[0], // Default name from email
        hubspotPortalId: String(hubspotUser.hub_id),
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiresAt,
      },
    })

    // Create session
    const sessionToken = await createSession(user.id)
    await setSessionCookie(sessionToken)

    // Redirect to chat with session cookie
    const response = redirectWithCleanup(request, '/chat')
    response.cookies.set('ri_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60,
      path: '/',
    })

    return response
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    // Log detailed context for debugging (never log tokens)
    console.error('OAuth callback error:', errorMessage)
    console.error('OAuth debug context:', {
      hasClientId: !!process.env.HUBSPOT_CLIENT_ID,
      hasClientSecret: !!process.env.HUBSPOT_CLIENT_SECRET,
      redirectUri: process.env.HUBSPOT_REDIRECT_URI,
      hasSessionSecret: !!process.env.SESSION_SECRET,
      hasEncryptionKey: !!process.env.TOKEN_ENCRYPTION_KEY,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
    })
    return redirectWithCleanup(request, '/login?error=auth_failed')
  }
}
