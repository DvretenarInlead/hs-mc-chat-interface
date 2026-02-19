import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { UserRole, SensitivityCategory, MaskStyle } from '@prisma/client'
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

// GET: List all sensitivity rules
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const rules = await prisma.sensitivityRule.findMany({
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ rules })
}

const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  pattern: z.string().min(1).max(1000),
  category: z.nativeEnum(SensitivityCategory),
  maskStyle: z.nativeEnum(MaskStyle).default('FULL'),
  isActive: z.boolean().default(true),
})

// POST: Create a new sensitivity rule
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = createRuleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Validate that the regex pattern is valid
  try {
    new RegExp(parsed.data.pattern)
  } catch {
    return NextResponse.json(
      { error: 'Invalid regex pattern' },
      { status: 400 }
    )
  }

  const rule = await prisma.sensitivityRule.create({
    data: parsed.data,
  })

  return NextResponse.json({ rule }, { status: 201 })
}

const updateRuleSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  pattern: z.string().min(1).max(1000).optional(),
  category: z.nativeEnum(SensitivityCategory).optional(),
  maskStyle: z.nativeEnum(MaskStyle).optional(),
  isActive: z.boolean().optional(),
})

// PUT: Update a sensitivity rule
export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = updateRuleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { id, ...data } = parsed.data

  // Validate regex if updating pattern
  if (data.pattern) {
    try {
      new RegExp(data.pattern)
    } catch {
      return NextResponse.json({ error: 'Invalid regex pattern' }, { status: 400 })
    }
  }

  // Prevent editing built-in rules' pattern
  const existing = await prisma.sensitivityRule.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }
  if (existing.isBuiltIn && data.pattern) {
    return NextResponse.json(
      { error: 'Cannot modify pattern of built-in rules' },
      { status: 400 }
    )
  }

  const rule = await prisma.sensitivityRule.update({
    where: { id },
    data,
  })

  return NextResponse.json({ rule })
}

// DELETE: Remove a sensitivity rule
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing rule ID' }, { status: 400 })
  }

  const existing = await prisma.sensitivityRule.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }
  if (existing.isBuiltIn) {
    return NextResponse.json(
      { error: 'Cannot delete built-in rules. Disable them instead.' },
      { status: 400 }
    )
  }

  await prisma.sensitivityRule.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
