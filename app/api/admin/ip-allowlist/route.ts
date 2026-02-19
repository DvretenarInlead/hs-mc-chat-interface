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

// Simple CIDR format validation
function isValidCidr(cidr: string): boolean {
  // Plain IP: 1.2.3.4 or CIDR: 1.2.3.0/24
  return /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(cidr)
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const entries = await prisma.ipAllowlistEntry.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ entries })
}

const createSchema = z.object({
  cidr: z.string().min(1).max(50),
  label: z.string().max(200).optional(),
})

export async function POST(request: NextRequest) {
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

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  if (!isValidCidr(parsed.data.cidr)) {
    return NextResponse.json(
      { error: 'Invalid IP/CIDR format. Use e.g. 192.168.1.0/24 or 10.0.0.1' },
      { status: 400 }
    )
  }

  const entry = await prisma.ipAllowlistEntry.create({
    data: {
      cidr: parsed.data.cidr,
      label: parsed.data.label || null,
    },
  })

  return NextResponse.json({ entry }, { status: 201 })
}

const updateSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean().optional(),
  label: z.string().max(200).optional(),
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

  const updateData: Record<string, unknown> = {}
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive
  if (parsed.data.label !== undefined) updateData.label = parsed.data.label

  const entry = await prisma.ipAllowlistEntry.update({
    where: { id: parsed.data.id },
    data: updateData,
  })

  return NextResponse.json({ entry })
}

const deleteSchema = z.object({
  id: z.string().min(1),
})

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

  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  await prisma.ipAllowlistEntry.delete({
    where: { id: parsed.data.id },
  })

  return NextResponse.json({ success: true })
}
