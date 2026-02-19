import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { UserRole } from '@prisma/client'
import { checkRateLimit } from '@/lib/rate-limit'

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

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
  const eventType = searchParams.get('eventType') || undefined

  const where = eventType ? { eventType: eventType as never } : {}

  const [events, total] = await Promise.all([
    prisma.securityEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.securityEvent.count({ where }),
  ])

  return NextResponse.json({
    events,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
