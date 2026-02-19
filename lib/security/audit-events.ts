import { prisma } from '@/lib/db/prisma'
import { SecurityEventType, Prisma } from '@prisma/client'

interface LogSecurityEventParams {
  userId?: string
  userEmail?: string
  eventType: SecurityEventType
  detail: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

export async function logSecurityEvent(params: LogSecurityEventParams) {
  try {
    await prisma.securityEvent.create({
      data: {
        userId: params.userId,
        userEmail: params.userEmail,
        eventType: params.eventType,
        detail: params.detail,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: params.metadata ? (params.metadata as Prisma.InputJsonValue) : undefined,
      },
    })
  } catch (err) {
    // Never let audit logging failure break the main flow
    console.error('Failed to log security event:', err instanceof Error ? err.message : 'Unknown error')
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}

export function getUserAgent(request: Request): string {
  return (request.headers.get('user-agent') || 'unknown').slice(0, 500)
}
