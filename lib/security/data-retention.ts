import { prisma } from '@/lib/db/prisma'

export interface RetentionResult {
  chatSessionsDeleted: number
  auditLogsDeleted: number
  securityEventsDeleted: number
}

/**
 * Run data retention cleanup based on the active policy.
 * Deletes records older than the configured thresholds.
 */
export async function runDataRetention(): Promise<RetentionResult> {
  // Load active policy
  const policy = await prisma.dataRetentionPolicy.findFirst({
    where: { isActive: true },
  })

  if (!policy) {
    return { chatSessionsDeleted: 0, auditLogsDeleted: 0, securityEventsDeleted: 0 }
  }

  const now = new Date()

  // Delete old chat sessions
  const chatCutoff = new Date(now.getTime() - policy.chatSessionMaxDays * 24 * 60 * 60 * 1000)
  const chatResult = await prisma.chatSession.deleteMany({
    where: { updatedAt: { lt: chatCutoff } },
  })

  // Delete old audit logs
  const auditCutoff = new Date(now.getTime() - policy.auditLogMaxDays * 24 * 60 * 60 * 1000)
  const auditResult = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: auditCutoff } },
  })

  // Delete old security events
  const secEventCutoff = new Date(now.getTime() - policy.securityEventMaxDays * 24 * 60 * 60 * 1000)
  const secResult = await prisma.securityEvent.deleteMany({
    where: { createdAt: { lt: secEventCutoff } },
  })

  // Update last run time
  await prisma.dataRetentionPolicy.update({
    where: { id: policy.id },
    data: { lastRunAt: now },
  })

  return {
    chatSessionsDeleted: chatResult.count,
    auditLogsDeleted: auditResult.count,
    securityEventsDeleted: secResult.count,
  }
}
