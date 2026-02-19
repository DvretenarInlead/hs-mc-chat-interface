import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { Prisma, RuleAction, UserRole } from '@prisma/client'
import { z } from 'zod'

// Validate user is ADMIN
async function requireAdmin(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return { error: 'Unauthorized', status: 401 }
  if (user.role !== UserRole.ADMIN) return { error: 'Forbidden', status: 403 }
  return { user }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const rules = await prisma.governanceRule.findMany({
    orderBy: [{ toolName: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ rules })
}

const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  toolName: z.string().min(1),
  action: z.nativeEnum(RuleAction),
  conditions: z.record(z.unknown()).optional(),
  appliesTo: z.array(z.nativeEnum(UserRole)).min(1),
  isActive: z.boolean().optional(),
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

  const parsed = createRuleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { conditions, ...rest } = parsed.data
  const rule = await prisma.governanceRule.create({
    data: {
      ...rest,
      conditions: conditions ? (conditions as Prisma.InputJsonValue) : undefined,
    },
  })

  return NextResponse.json({ rule }, { status: 201 })
}

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

  const updateSchema = createRuleSchema.extend({
    id: z.string().min(1),
  })

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { id, conditions: updateConditions, ...updateData } = parsed.data

  const rule = await prisma.governanceRule.update({
    where: { id },
    data: {
      ...updateData,
      conditions: updateConditions ? (updateConditions as Prisma.InputJsonValue) : undefined,
    },
  })

  return NextResponse.json({ rule })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Rule ID required' }, { status: 400 })
  }

  await prisma.governanceRule.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
