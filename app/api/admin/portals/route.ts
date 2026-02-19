import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { UserRole } from '@prisma/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { logSecurityEvent, getClientIp, getUserAgent } from '@/lib/security/audit-events'
import { z } from 'zod'

async function requireAdmin(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return { error: 'Unauthorized', status: 401 }
  if (user.role !== UserRole.ADMIN) return { error: 'Forbidden', status: 403 }
  const rateLimit = checkRateLimit(user.id)
  if (!rateLimit.allowed) return { error: 'Too many requests', status: 429 }
  return { user }
}

// GET: List all portals with user counts
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const portals = await prisma.portal.findMany({
    include: {
      users: {
        select: { id: true, email: true, name: true, role: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const sanitized = portals.map((p) => ({
    id: p.id,
    hubspotPortalId: p.hubspotPortalId,
    name: p.name,
    connectedById: p.connectedById,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    userCount: p.users.length,
    users: p.users,
  }))

  return NextResponse.json({ portals: sanitized })
}

const assignUsersSchema = z.object({
  portalId: z.string().min(1).max(100),
  userIds: z.array(z.string().min(1).max(100)),
})

const removePortalSchema = z.object({
  portalId: z.string().min(1).max(100),
})

// PUT: Assign users to a portal
export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = assignUsersSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { portalId, userIds } = parsed.data

  // Verify portal exists
  const portal = await prisma.portal.findUnique({ where: { id: portalId } })
  if (!portal) {
    return NextResponse.json({ error: 'Portal not found' }, { status: 404 })
  }

  // Assign users to portal
  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { portalId },
  })

  await logSecurityEvent({
    userId: auth.user.id,
    userEmail: auth.user.email,
    eventType: 'PORTAL_CONNECTED',
    detail: `Assigned ${userIds.length} user(s) to portal ${portal.hubspotPortalId}`,
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  })

  return NextResponse.json({ success: true })
}

// DELETE: Disconnect a portal
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = removePortalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error' }, { status: 400 })
  }

  const { portalId } = parsed.data

  // Unassign all users from this portal first
  await prisma.user.updateMany({
    where: { portalId },
    data: { portalId: null },
  })

  await prisma.portal.delete({ where: { id: portalId } })

  await logSecurityEvent({
    userId: auth.user.id,
    userEmail: auth.user.email,
    eventType: 'PORTAL_DISCONNECTED',
    detail: `Portal ${portalId} disconnected`,
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  })

  return NextResponse.json({ success: true })
}
