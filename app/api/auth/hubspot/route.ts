import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizationUrl } from '@/lib/auth/hubspot-oauth'
import { getUserFromRequest } from '@/lib/auth/session'
import { UserRole } from '@prisma/client'
import { randomBytes } from 'crypto'

export async function GET(request: NextRequest) {
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

  // Only admins can initiate portal connection
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json(
      { error: 'You must be logged in to connect a portal. Please sign in first.' },
      { status: 401 }
    )
  }
  if (user.role !== UserRole.ADMIN) {
    return NextResponse.json(
      { error: 'Only admins can connect HubSpot portals.' },
      { status: 403 }
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
