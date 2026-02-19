import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { UserRole } from '@prisma/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

async function requireAdmin(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return { error: 'Unauthorized', status: 401 }
  if (user.role !== UserRole.ADMIN) return { error: 'Forbidden', status: 403 }

  const rateLimit = checkRateLimit(user.id)
  if (!rateLimit.allowed) return { error: 'Too many requests', status: 429 }

  return { user }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      hubspotPortalId: true,
      chatPinRequired: true,
      chatPinHash: true,
      chatPinLockedUntil: true,
      chatPinFailures: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  // Don't expose actual hash — just whether PIN is set
  const sanitizedUsers = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    hubspotPortalId: u.hubspotPortalId,
    chatPinRequired: u.chatPinRequired,
    hasChatPin: !!u.chatPinHash,
    chatPinLockedUntil: u.chatPinLockedUntil,
    chatPinFailures: u.chatPinFailures,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }))

  return NextResponse.json({ users: sanitizedUsers })
}

const updateUserSchema = z.object({
  userId: z.string().min(1).max(100),
  role: z.nativeEnum(UserRole).optional(),
  chatPinRequired: z.boolean().optional(),
  resetPin: z.boolean().optional(),
  unlockPin: z.boolean().optional(),
})

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

  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Prevent admin from demoting themselves
  if (parsed.data.userId === auth.user.id && parsed.data.role && parsed.data.role !== UserRole.ADMIN) {
    return NextResponse.json(
      { error: 'Cannot change your own role' },
      { status: 400 }
    )
  }

  const updateData: Record<string, unknown> = {}

  if (parsed.data.role !== undefined) {
    updateData.role = parsed.data.role
  }

  if (parsed.data.chatPinRequired !== undefined) {
    updateData.chatPinRequired = parsed.data.chatPinRequired
  }

  // Admin can reset a user's PIN (clears hash, forces re-setup)
  if (parsed.data.resetPin) {
    updateData.chatPinHash = null
    updateData.chatPinSetAt = null
    updateData.chatPinFailures = 0
    updateData.chatPinLockedUntil = null
  }

  // Admin can unlock a locked-out user
  if (parsed.data.unlockPin) {
    updateData.chatPinFailures = 0
    updateData.chatPinLockedUntil = null
  }

  const user = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      chatPinRequired: true,
      chatPinHash: true,
      chatPinFailures: true,
      chatPinLockedUntil: true,
    },
  })

  return NextResponse.json({
    user: {
      ...user,
      chatPinHash: undefined,
      hasChatPin: !!user.chatPinHash,
    },
  })
}
