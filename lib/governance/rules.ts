import { prisma } from '@/lib/db/prisma'
import { RuleAction, UserRole } from '@prisma/client'
import type { GovernanceEvaluation, ToolCallInfo } from './types'

export async function evaluateGovernanceRule(
  toolCall: ToolCallInfo,
  userRole: UserRole
): Promise<GovernanceEvaluation> {
  const rules = await prisma.governanceRule.findMany({
    where: {
      toolName: toolCall.name,
      isActive: true,
      appliesTo: { has: userRole },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (rules.length === 0) {
    // No rule found — default to REQUIRE_CONFIRM for safety
    return {
      action: RuleAction.REQUIRE_CONFIRM,
      name: 'default_safety',
      confirmationMessage: `No governance rule configured for "${toolCall.name}". Please confirm to proceed.`,
    }
  }

  const rule = rules[0]

  return {
    action: rule.action,
    name: rule.name,
    confirmationMessage:
      rule.action === RuleAction.REQUIRE_CONFIRM
        ? `This will ${describeToolCall(toolCall)}. Do you want to proceed?`
        : undefined,
  }
}

function describeToolCall(toolCall: ToolCallInfo): string {
  const { name, input } = toolCall
  const parts: string[] = []

  if (name.includes('create_note') || name.includes('add_note')) {
    parts.push('create a note')
    if (input.objectType) parts.push(`on ${input.objectType}`)
    if (input.objectId) parts.push(`(ID: ${input.objectId})`)
  } else if (name.includes('create_task') || name.includes('add_task')) {
    parts.push('create a task')
    if (input.subject) parts.push(`"${input.subject}"`)
  } else if (name.includes('update')) {
    parts.push('update a CRM record')
    if (input.objectType) parts.push(`(${input.objectType})`)
    if (input.objectId) parts.push(`ID: ${input.objectId}`)
  } else if (name.includes('delete')) {
    parts.push('delete a CRM record')
    if (input.objectType) parts.push(`(${input.objectType})`)
    if (input.objectId) parts.push(`ID: ${input.objectId}`)
  } else {
    parts.push(`execute "${name}"`)
  }

  return parts.join(' ')
}

export function isWriteOperation(toolName: string): boolean {
  return (
    toolName.includes('create') ||
    toolName.includes('update') ||
    toolName.includes('delete') ||
    toolName.includes('add') ||
    toolName.includes('remove') ||
    toolName.includes('edit')
  )
}
