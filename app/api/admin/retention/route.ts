import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { UserRole } from '@prisma/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { runDataRetention } from '@/lib/security/data-retention'
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

  const policy = await prisma.dataRetentionPolicy.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ policy })
}

const updateSchema = z.object({
  chatSessionMaxDays: z.number().int().min(1).max(3650).optional(),
  auditLogMaxDays: z.number().int().min(1).max(3650).optional(),
  securityEventMaxDays: z.number().int().min(1).max(3650).optional(),
  isActive: z.boolean().optional(),
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

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Upsert: create if none exists, update the active one
  let policy = await prisma.dataRetentionPolicy.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  })

  if (policy) {
    policy = await prisma.dataRetentionPolicy.update({
      where: { id: policy.id },
      data: parsed.data,
    })
  } else {
    policy = await prisma.dataRetentionPolicy.create({
      data: {
        chatSessionMaxDays: parsed.data.chatSessionMaxDays ?? 90,
        auditLogMaxDays: parsed.data.auditLogMaxDays ?? 365,
        securityEventMaxDays: parsed.data.securityEventMaxDays ?? 365,
        isActive: parsed.data.isActive ?? true,
      },
    })
  }

  return NextResponse.json({ policy })
}

// POST: Manually trigger data retention cleanup
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const result = await runDataRetention()
  return NextResponse.json({ success: true, ...result })
}
