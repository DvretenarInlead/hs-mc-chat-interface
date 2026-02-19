import { prisma } from '@/lib/db/prisma'
import { MaskStyle, SensitivityCategory, UserRole } from '@prisma/client'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  VIEWER: 0,
  POWER_USER: 1,
  ADMIN: 2,
}

export interface MaskingRule {
  pattern: RegExp
  category: string
  maskStyle: MaskStyle
  name: string
  /** Minimum role to see this data unmasked. Roles below this get masking applied. */
  visibleAbove?: UserRole
}

// Built-in patterns for common PII types
const BUILT_IN_PATTERNS: Array<{
  name: string
  pattern: string
  category: SensitivityCategory
  maskStyle: MaskStyle
  visibleAbove: UserRole
}> = [
  {
    name: 'Email Address',
    pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    category: 'EMAIL',
    maskStyle: 'PARTIAL',
    visibleAbove: 'POWER_USER', // ADMIN sees unmasked, POWER_USER & VIEWER get masked
  },
  {
    name: 'Phone Number (US)',
    pattern: '(?:\\+1[\\s.-]?)?(?:\\(?\\d{3}\\)?[\\s.-]?)\\d{3}[\\s.-]?\\d{4}',
    category: 'PHONE',
    maskStyle: 'PARTIAL',
    visibleAbove: 'POWER_USER',
  },
  {
    name: 'SSN',
    pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b',
    category: 'SSN',
    maskStyle: 'REDACT',
    visibleAbove: 'ADMIN', // Nobody sees SSN unmasked except via explicit DB access
  },
  {
    name: 'Credit Card',
    pattern: '\\b(?:\\d{4}[\\s-]?){3}\\d{4}\\b',
    category: 'CREDIT_CARD',
    maskStyle: 'REDACT',
    visibleAbove: 'ADMIN',
  },
  {
    name: 'API Key Pattern',
    pattern: '(?:sk|pk|api|key|token|secret)[_-]?[a-zA-Z0-9]{20,}',
    category: 'API_KEY',
    maskStyle: 'FULL',
    visibleAbove: 'ADMIN',
  },
]

function maskEmail(email: string, style: MaskStyle): string {
  if (style === 'REDACT') return '[REDACTED EMAIL]'
  if (style === 'FULL') return '********'

  // PARTIAL: jo***@***.com
  const atIdx = email.indexOf('@')
  if (atIdx <= 0) return '********'
  const localPart = email.slice(0, atIdx)
  const domainPart = email.slice(atIdx + 1)
  const dotIdx = domainPart.lastIndexOf('.')
  const tld = dotIdx >= 0 ? domainPart.slice(dotIdx) : ''

  const maskedLocal = localPart.length <= 2
    ? localPart[0] + '***'
    : localPart.slice(0, 2) + '***'
  const maskedDomain = '***' + tld

  return `${maskedLocal}@${maskedDomain}`
}

function maskPhone(phone: string, style: MaskStyle): string {
  if (style === 'REDACT') return '[REDACTED PHONE]'
  if (style === 'FULL') return '********'

  // PARTIAL: show last 4 digits
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '********'
  return '***-***-' + digits.slice(-4)
}

function maskGeneric(text: string, style: MaskStyle, category: string): string {
  if (style === 'REDACT') return `[REDACTED ${category}]`
  if (style === 'PARTIAL') {
    if (text.length <= 4) return '****'
    return text.slice(0, 2) + '*'.repeat(text.length - 4) + text.slice(-2)
  }
  // FULL
  return '*'.repeat(Math.min(text.length, 16))
}

function applyMask(matched: string, category: string, style: MaskStyle): string {
  switch (category) {
    case 'EMAIL':
      return maskEmail(matched, style)
    case 'PHONE':
      return maskPhone(matched, style)
    case 'SSN':
      return style === 'PARTIAL' ? '***-**-' + matched.slice(-4) : maskGeneric(matched, style, category)
    case 'CREDIT_CARD':
      return style === 'PARTIAL'
        ? '****-****-****-' + matched.replace(/\D/g, '').slice(-4)
        : maskGeneric(matched, style, category)
    default:
      return maskGeneric(matched, style, category)
  }
}

export async function loadSensitivityRules(): Promise<MaskingRule[]> {
  const rules: MaskingRule[] = []

  // Load DB rules
  try {
    const dbRules = await prisma.sensitivityRule.findMany({
      where: { isActive: true },
    })

    for (const rule of dbRules) {
      try {
        const regex = new RegExp(rule.pattern, 'g')
        rules.push({
          pattern: regex,
          category: rule.category,
          maskStyle: rule.maskStyle,
          name: rule.name,
        })
      } catch {
        console.error(`Invalid regex in sensitivity rule "${rule.name}": ${rule.pattern}`)
      }
    }
  } catch {
    // If DB is unavailable, fall through to built-in rules
  }

  // Add built-in patterns (these always apply unless a DB rule overrides them)
  for (const builtin of BUILT_IN_PATTERNS) {
    const hasDbOverride = rules.some((r) => r.category === builtin.category)
    if (!hasDbOverride) {
      try {
        rules.push({
          pattern: new RegExp(builtin.pattern, 'g'),
          category: builtin.category,
          maskStyle: builtin.maskStyle,
          name: builtin.name,
          visibleAbove: builtin.visibleAbove,
        })
      } catch {
        // Skip if regex is invalid
      }
    }
  }

  return rules
}

/**
 * Apply data masking with role-based visibility.
 * If userRole is provided, rules with visibleAbove are only applied
 * when the user's role is below the threshold.
 */
export function applyDataMasking(
  text: string,
  rules: MaskingRule[],
  userRole?: UserRole
): string {
  if (!text || rules.length === 0) return text

  let masked = text
  for (const rule of rules) {
    // Role-based: skip masking if user's role is high enough
    if (userRole && rule.visibleAbove) {
      if (ROLE_HIERARCHY[userRole] > ROLE_HIERARCHY[rule.visibleAbove]) {
        continue
      }
    }

    // Reset regex lastIndex since we reuse the same RegExp objects
    rule.pattern.lastIndex = 0
    masked = masked.replace(rule.pattern, (match) => {
      return applyMask(match, rule.category, rule.maskStyle)
    })
  }

  return masked
}

// Expose built-in patterns for seeding
export { BUILT_IN_PATTERNS }
