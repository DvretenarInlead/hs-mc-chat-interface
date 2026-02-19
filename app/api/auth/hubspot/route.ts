import { NextResponse } from 'next/server'
import { getAuthorizationUrl } from '@/lib/auth/hubspot-oauth'
import { randomBytes } from 'crypto'

export async function GET() {
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
