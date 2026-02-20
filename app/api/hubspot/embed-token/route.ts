import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const EMBED_TOKEN_MAX_AGE = 5 * 60 // 5 minutes

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')
  return new TextEncoder().encode(secret)
}

const requestSchema = z.object({
  portalId: z.string().min(1),
  userEmail: z.string().email(),
  objectId: z.string().min(1),
  objectType: z.string().min(1),
})

/**
 * Generate a short-lived embed token for HubSpot iframe auth.
 * Called by the HubSpot UI Extension via hubspot.fetch().
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { portalId, userEmail, objectId, objectType } = parsed.data

  // Verify the portal exists and is connected
  const portal = await prisma.portal.findUnique({
    where: { hubspotPortalId: portalId },
  })
  if (!portal) {
    return NextResponse.json(
      { error: 'Portal not connected. An admin must connect this HubSpot portal first.' },
      { status: 404 }
    )
  }

  // Find the user by email and verify they are assigned to this portal
  const user = await prisma.user.findUnique({
    where: { email: userEmail.toLowerCase() },
  })
  if (!user) {
    return NextResponse.json(
      { error: 'User not found. An admin must create your account first.' },
      { status: 404 }
    )
  }
  if (user.portalId !== portal.id) {
    return NextResponse.json(
      { error: 'User is not assigned to this portal.' },
      { status: 403 }
    )
  }

  // Generate a short-lived embed token
  const token = await new SignJWT({
    userId: user.id,
    portalId: portal.id,
    objectId,
    objectType,
    purpose: 'hubspot-embed',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${EMBED_TOKEN_MAX_AGE}s`)
    .setIssuedAt()
    .sign(getSessionSecret())

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const embedUrl = `${appUrl}/hubspot-embed?token=${encodeURIComponent(token)}`

  return NextResponse.json({ token, embedUrl })
}
