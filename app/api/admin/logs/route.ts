import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { LogStatus, UserRole } from '@prisma/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const datePattern = /^\d{4}-\d{2}-\d{2}$/

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().max(100).optional(),
  toolName: z.string().max(200).optional(),
  status: z.nativeEnum(LogStatus).optional(),
  dateFrom: z.string().regex(datePattern, 'Must be YYYY-MM-DD').optional(),
  dateTo: z.string().regex(datePattern, 'Must be YYYY-MM-DD').optional(),
})

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Rate limit admin endpoints
  const rateLimit = checkRateLimit(user.id)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429 }
    )
  }

  const { searchParams } = new URL(request.url)
  const rawParams: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    rawParams[key] = value
  })

  const parsed = querySchema.safeParse(rawParams)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { page, limit, userId, toolName, status, dateFrom, dateTo } = parsed.data

  const where: Record<string, unknown> = {}
  if (userId) where.userId = userId
  if (toolName) where.toolName = { contains: toolName, mode: 'insensitive' }
  if (status) where.status = status
  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (dateFrom) dateFilter.gte = new Date(dateFrom)
    if (dateTo) dateFilter.lte = new Date(dateTo)
    where.createdAt = dateFilter
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
