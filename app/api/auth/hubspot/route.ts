import { NextResponse } from 'next/server'
import { getAuthorizationUrl } from '@/lib/auth/hubspot-oauth'
import { randomBytes } from 'crypto'

export async function GET() {
  // Fail fast with a clear message if HubSpot env vars are missing
  if (!process.env.HUBSPOT_CLIENT_ID || !process.env.HUBSPOT_REDIRECT_URI) {
    return NextResponse.json(
      {
        error: 'HubSpot OAuth not configured',
        missing: [
          !process.env.HUBSPOT_CLIENT_ID && 'HUBSPOT_CLIENT_ID',
          !process.env.HUBSPOT_REDIRECT_URI && 'HUBSPOT_REDIRECT_URI',
        ].filter(Boolean),
      },
      { status: 500 }
    )
  }

  // Generate a state parameter for CSRF protection
  const state = randomBytes(32).toString('hex')

  const authUrl = getAuthorizationUrl(state)

  const response = NextResponse.redirect(authUrl)

  // Store state in a cookie to verify on callback
  response.cookies.set('hubspot_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  return response
}
