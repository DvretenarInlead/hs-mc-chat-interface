import { prisma } from './prisma'
import { AuditAction, LogStatus } from '@prisma/client'

interface AuditLogParams {
  userId: string
  userEmail: string
  action: AuditAction
  toolName: string
  inputSummary: string
  outputSummary?: string
  recordType?: string
  recordId?: string
  status?: LogStatus
  requiresApproval?: boolean
}

export async function createAuditLog(params: AuditLogParams) {
  return prisma.auditLog.create({
    data: {
      userId: params.userId,
      userEmail: params.userEmail,
      action: params.action,
      toolName: params.toolName,
      inputSummary: params.inputSummary,
      outputSummary: params.outputSummary,
      recordType: params.recordType,
      recordId: params.recordId,
      status: params.status ?? LogStatus.PENDING,
      requiresApproval: params.requiresApproval ?? false,
    },
  })
}

export async function updateAuditLogStatus(
  id: string,
  status: LogStatus,
  outputSummary?: string
) {
  return prisma.auditLog.update({
    where: { id },
    data: {
      status,
      outputSummary,
      ...(status === LogStatus.APPROVED ? { approvedAt: new Date() } : {}),
    },
  })
}

export function classifyToolAction(toolName: string): AuditAction {
  if (toolName.includes('create') || toolName.includes('add')) return AuditAction.CREATE
  if (toolName.includes('update') || toolName.includes('edit')) return AuditAction.UPDATE
  if (toolName.includes('delete') || toolName.includes('remove')) return AuditAction.DELETE
  return AuditAction.READ
}
