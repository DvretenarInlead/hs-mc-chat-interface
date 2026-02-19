import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { UserRole, MaskStyle } from '@prisma/client'
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

  const fields = await prisma.sensitiveField.findMany({
    orderBy: [{ objectType: 'asc' }, { fieldName: 'asc' }],
  })

  return NextResponse.json({ fields })
}

const createSchema = z.object({
  objectType: z.string().min(1).max(100),
  fieldName: z.string().min(1).max(200),
  label: z.string().min(1).max(200),
  maskStyle: z.nativeEnum(MaskStyle).optional(),
  minRole: z.nativeEnum(UserRole).optional(),
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

  // Check for duplicate
  const existing = await prisma.sensitiveField.findUnique({
    where: {
      objectType_fieldName: {
        objectType: parsed.data.objectType,
        fieldName: parsed.data.fieldName,
      },
    },
  })

  if (existing) {
    return NextResponse.json(
      { error: `Field "${parsed.data.fieldName}" on "${parsed.data.objectType}" already exists` },
      { status: 409 }
    )
  }

  const field = await prisma.sensitiveField.create({
    data: {
      objectType: parsed.data.objectType,
      fieldName: parsed.data.fieldName,
      label: parsed.data.label,
      maskStyle: parsed.data.maskStyle ?? MaskStyle.PARTIAL,
      minRole: parsed.data.minRole ?? UserRole.ADMIN,
    },
  })

  return NextResponse.json({ field }, { status: 201 })
}

const updateSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean().optional(),
  maskStyle: z.nativeEnum(MaskStyle).optional(),
  minRole: z.nativeEnum(UserRole).optional(),
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
  if (parsed.data.maskStyle !== undefined) updateData.maskStyle = parsed.data.maskStyle
  if (parsed.data.minRole !== undefined) updateData.minRole = parsed.data.minRole
  if (parsed.data.label !== undefined) updateData.label = parsed.data.label

  const field = await prisma.sensitiveField.update({
    where: { id: parsed.data.id },
    data: updateData,
  })

  return NextResponse.json({ field })
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

  await prisma.sensitiveField.delete({
    where: { id: parsed.data.id },
  })

  return NextResponse.json({ success: true })
}
