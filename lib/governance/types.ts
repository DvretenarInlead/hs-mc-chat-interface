import { RuleAction, UserRole } from '@prisma/client'

export interface GovernanceRuleInput {
  name: string
  description?: string
  toolName: string
  action: RuleAction
  conditions?: Record<string, unknown>
  appliesTo: UserRole[]
  isActive?: boolean
}

export interface GovernanceEvaluation {
  action: RuleAction
  name: string
  confirmationMessage?: string
}

export interface ToolCallInfo {
  name: string
  input: Record<string, unknown>
}
