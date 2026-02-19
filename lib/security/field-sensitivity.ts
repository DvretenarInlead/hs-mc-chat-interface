import { prisma } from '@/lib/db/prisma'
import { MaskStyle, UserRole } from '@prisma/client'

export interface FieldRule {
  objectType: string
  fieldName: string
  maskStyle: MaskStyle
  minRole: UserRole
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  VIEWER: 0,
  POWER_USER: 1,
  ADMIN: 2,
}

/**
 * Load all active sensitive field rules from the database.
 */
export async function loadSensitiveFieldRules(): Promise<FieldRule[]> {
  try {
    const fields = await prisma.sensitiveField.findMany({
      where: { isActive: true },
    })
    return fields.map((f) => ({
      objectType: f.objectType,
      fieldName: f.fieldName,
      maskStyle: f.maskStyle,
      minRole: f.minRole,
    }))
  } catch {
    return []
  }
}

/**
 * Check if a user's role is sufficient to see a field unmasked.
 */
export function canSeeField(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole]
}

/**
 * Mask a field value based on its style.
 */
export function maskFieldValue(value: string, style: MaskStyle): string {
  if (!value) return value

  switch (style) {
    case 'REDACT':
      return '[RESTRICTED]'
    case 'FULL':
      return '*'.repeat(Math.min(value.length, 16))
    case 'PARTIAL':
      if (value.length <= 4) return '****'
      return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2)
    default:
      return '[RESTRICTED]'
  }
}

/**
 * Apply field-level masking to a tool result string based on the user's role.
 * Looks for patterns like "fieldName": "value" and masks if the user's role
 * is below the minimum required.
 */
export function applyFieldMasking(
  content: string,
  fieldRules: FieldRule[],
  userRole: UserRole
): string {
  if (!content || fieldRules.length === 0) return content

  let masked = content
  for (const rule of fieldRules) {
    if (canSeeField(userRole, rule.minRole)) continue

    // Match JSON-style field values: "fieldName": "value" or "fieldName":"value"
    const fieldPattern = new RegExp(
      `("${escapeRegex(rule.fieldName)}"\\s*:\\s*")([^"]*)(")`,
      'g'
    )
    masked = masked.replace(fieldPattern, (_match, prefix, value, suffix) => {
      return prefix + maskFieldValue(value, rule.maskStyle) + suffix
    })

    // Also match plain-text mentions like "fieldName: value" in natural language
    const plainPattern = new RegExp(
      `(${escapeRegex(rule.fieldName)}:\\s*)(\\S+)`,
      'gi'
    )
    masked = masked.replace(plainPattern, (_match, prefix, value) => {
      return prefix + maskFieldValue(value, rule.maskStyle)
    })
  }

  return masked
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
