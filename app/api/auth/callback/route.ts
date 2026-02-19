import { NextRequest, NextResponse } from 'next/server'
import {
  exchangeCodeForTokens,
  getUserFromToken,
} from '@/lib/auth/hubspot-oauth'
import { encrypt } from '@/lib/auth/encryption'
import { getUserFromRequest } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { UserRole } from '@prisma/client'
import { logSecurityEvent, getClientIp, getUserAgent } from '@/lib/security/audit-events'

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

  // Check for OAuth errors from HubSpot
  if (error) {
    console.error('[OAuth] HubSpot returned error:', error, searchParams.get('error_description'))
    return redirectWithCleanup(request, '/admin/portals?error=oauth_error')
  }

  if (!code) {
    console.error('[OAuth] No authorization code in callback')
    return redirectWithCleanup(request, '/admin/portals?error=no_code')
  }

  // Verify CSRF state
  const storedState = request.cookies.get('hubspot_oauth_state')?.value
  if (!state || !storedState || state !== storedState) {
    console.error('[OAuth] State mismatch')
    return redirectWithCleanup(request, '/admin/portals?error=invalid_state')
  }

  // Verify the current user is an admin
  const currentUser = await getUserFromRequest(request)
  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    console.error('[OAuth] Non-admin attempted portal connection')
    return redirectWithCleanup(request, '/admin/portals?error=forbidden')
  }

  let step = 'token_exchange'
  try {
    // Step 1: Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)
    console.log('[OAuth] Token exchange successful')

    // Step 2: Get portal info from HubSpot
    step = 'user_info'
    const hubspotInfo = await getUserFromToken(tokens.access_token)
    console.log('[OAuth] Got portal info:', { hubId: hubspotInfo.hub_id })

    // Step 3: Encrypt tokens
    step = 'encryption'
    const encryptedAccess = encrypt(tokens.access_token)
    const encryptedRefresh = encrypt(tokens.refresh_token)
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Step 4: Create or update portal
    step = 'db_upsert'
    const portal = await prisma.portal.upsert({
      where: { hubspotPortalId: String(hubspotInfo.hub_id) },
      update: {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt,
        connectedById: currentUser.id,
      },
      create: {
        hubspotPortalId: String(hubspotInfo.hub_id),
        name: hubspotInfo.hub_domain || `Portal ${hubspotInfo.hub_id}`,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt,
        connectedById: currentUser.id,
      },
    })
    console.log('[OAuth] Portal upserted:', portal.id)

    await logSecurityEvent({
      userId: currentUser.id,
      userEmail: currentUser.email,
      eventType: 'PORTAL_CONNECTED',
      detail: `HubSpot portal ${hubspotInfo.hub_id} connected`,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    })

    return redirectWithCleanup(request, '/admin/portals?success=connected')
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[OAuth] Failed at step "${step}":`, errorMessage)
    return redirectWithCleanup(request, `/admin/portals?error=${step}_failed`)
  }
}
