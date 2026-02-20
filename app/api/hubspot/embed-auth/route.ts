import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')
  return new TextEncoder().encode(secret)
}

const requestSchema = z.object({
  token: z.string().min(1),
})

/**
 * Exchange a short-lived embed token for a full session token.
 * Called by the HubSpot embed page on load.
 * Returns the session token + CRM context (not set as cookie — used via Authorization header).
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
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  try {
    const { payload } = await jwtVerify(parsed.data.token, getSessionSecret())

    if (payload.purpose !== 'hubspot-embed') {
      return NextResponse.json({ error: 'Invalid token type' }, { status: 401 })
    }

    const userId = payload.userId as string
    const objectId = payload.objectId as string
    const objectType = payload.objectType as string

    // Verify user still exists and has portal access
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { portal: true },
    })
    if (!user || !user.portal) {
      return NextResponse.json({ error: 'User or portal not found' }, { status: 404 })
    }

    // Create a real session (same as normal login)
    const sessionToken = await createSession(userId)

    return NextResponse.json({
      sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      context: {
        objectId,
        objectType,
        portalName: user.portal.name,
        hubspotPortalId: user.portal.hubspotPortalId,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Token expired or invalid. Please reload the page.' },
      { status: 401 }
    )
  }
}
