import { NextRequest, NextResponse } from 'next/server'
import {
  exchangeCodeForTokens,
  getUserFromToken,
} from '@/lib/auth/hubspot-oauth'
import { encrypt } from '@/lib/auth/encryption'
import { createSession, setSessionCookie } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Check for OAuth errors
  if (error) {
    console.error('HubSpot OAuth error:', error)
    return NextResponse.redirect(
      new URL('/login?error=oauth_error', request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=no_code', request.url)
    )
  }

  // Verify CSRF state
  const storedState = request.cookies.get('hubspot_oauth_state')?.value
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      new URL('/login?error=invalid_state', request.url)
    )
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

    // Clear the OAuth state cookie
    const response = NextResponse.redirect(new URL('/chat', request.url))
    response.cookies.delete('hubspot_oauth_state')

    // Set the session cookie on the redirect response too
    response.cookies.set('ri_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60,
      path: '/',
    })

    return response
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(
      new URL('/login?error=auth_failed', request.url)
    )
  }
}
