import { PrismaClient, RuleAction, UserRole, SensitivityCategory, MaskStyle } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_RULES = [
  // READ operations — always allow
  {
    name: 'Allow CRM Search',
    description: 'Allow all users to search CRM records',
    toolName: 'hubspot_search_crm',
    action: RuleAction.ALLOW,
    appliesTo: [UserRole.ADMIN, UserRole.POWER_USER, UserRole.VIEWER],
  },
  {
    name: 'Allow Get CRM Record',
    description: 'Allow all users to view individual CRM records',
    toolName: 'hubspot_get_crm_record',
    action: RuleAction.ALLOW,
    appliesTo: [UserRole.ADMIN, UserRole.POWER_USER, UserRole.VIEWER],
  },

  // CREATE note — admin can do freely, power users need confirmation, viewers blocked
  {
    name: 'Allow Admin Create Note',
    description: 'Admins can create notes without confirmation',
    toolName: 'hubspot_create_note',
    action: RuleAction.ALLOW,
    appliesTo: [UserRole.ADMIN],
  },
  {
    name: 'Confirm Power User Create Note',
    description: 'Power users must confirm before creating notes',
    toolName: 'hubspot_create_note',
    action: RuleAction.REQUIRE_CONFIRM,
    appliesTo: [UserRole.POWER_USER],
  },
  {
    name: 'Block Viewer Create Note',
    description: 'Viewers cannot create notes',
    toolName: 'hubspot_create_note',
    action: RuleAction.BLOCK,
    appliesTo: [UserRole.VIEWER],
  },

  // CREATE task
  {
    name: 'Allow Admin Create Task',
    description: 'Admins can create tasks without confirmation',
    toolName: 'hubspot_create_task',
    action: RuleAction.ALLOW,
    appliesTo: [UserRole.ADMIN],
  },
  {
    name: 'Confirm Power User Create Task',
    description: 'Power users must confirm before creating tasks',
    toolName: 'hubspot_create_task',
    action: RuleAction.REQUIRE_CONFIRM,
    appliesTo: [UserRole.POWER_USER],
  },
  {
    name: 'Block Viewer Create Task',
    description: 'Viewers cannot create tasks',
    toolName: 'hubspot_create_task',
    action: RuleAction.BLOCK,
    appliesTo: [UserRole.VIEWER],
  },

  // UPDATE operations — require confirmation for admin/power user, block for viewers
  {
    name: 'Confirm Admin Update Record',
    description: 'Admins must confirm before updating CRM records',
    toolName: 'hubspot_update_crm_record',
    action: RuleAction.REQUIRE_CONFIRM,
    appliesTo: [UserRole.ADMIN, UserRole.POWER_USER],
  },
  {
    name: 'Block Viewer Update Record',
    description: 'Viewers cannot update CRM records',
    toolName: 'hubspot_update_crm_record',
    action: RuleAction.BLOCK,
    appliesTo: [UserRole.VIEWER],
  },

  // DELETE — always block at MVP stage
  {
    name: 'Block All Delete Operations',
    description: 'Delete operations are blocked for all users in MVP',
    toolName: 'hubspot_delete_crm_record',
    action: RuleAction.BLOCK,
    appliesTo: [UserRole.ADMIN, UserRole.POWER_USER, UserRole.VIEWER],
  },
]

async function main() {
  console.log('Seeding default governance rules...')

  for (const rule of DEFAULT_RULES) {
    await prisma.governanceRule.upsert({
      where: {
        id: `seed_${rule.toolName}_${rule.appliesTo.join('_')}`,
      },
      update: rule,
      create: {
        id: `seed_${rule.toolName}_${rule.appliesTo.join('_')}`,
        ...rule,
      },
    })
  }

  console.log(`Seeded ${DEFAULT_RULES.length} governance rules.`)

  // Seed default sensitivity rules
  console.log('Seeding default sensitivity rules...')

  const SENSITIVITY_RULES = [
    {
      id: 'builtin_email',
      name: 'Email Address',
      description: 'Masks email addresses in chat responses',
      pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
      category: SensitivityCategory.EMAIL,
      maskStyle: MaskStyle.PARTIAL,
      isBuiltIn: true,
      isActive: true,
    },
    {
      id: 'builtin_phone',
      name: 'Phone Number (US)',
      description: 'Masks US phone numbers in chat responses',
      pattern: '(?:\\+1[\\s.-]?)?(?:\\(?\\d{3}\\)?[\\s.-]?)\\d{3}[\\s.-]?\\d{4}',
      category: SensitivityCategory.PHONE,
      maskStyle: MaskStyle.PARTIAL,
      isBuiltIn: true,
      isActive: true,
    },
    {
      id: 'builtin_ssn',
      name: 'Social Security Number',
      description: 'Redacts SSN patterns in chat responses',
      pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b',
      category: SensitivityCategory.SSN,
      maskStyle: MaskStyle.REDACT,
      isBuiltIn: true,
      isActive: true,
    },
    {
      id: 'builtin_credit_card',
      name: 'Credit Card Number',
      description: 'Redacts credit card number patterns',
      pattern: '\\b(?:\\d{4}[\\s-]?){3}\\d{4}\\b',
      category: SensitivityCategory.CREDIT_CARD,
      maskStyle: MaskStyle.REDACT,
      isBuiltIn: true,
      isActive: true,
    },
    {
      id: 'builtin_api_key',
      name: 'API Key Pattern',
      description: 'Masks API keys and tokens that may appear in CRM data',
      pattern: '(?:sk|pk|api|key|token|secret)[_-]?[a-zA-Z0-9]{20,}',
      category: SensitivityCategory.API_KEY,
      maskStyle: MaskStyle.FULL,
      isBuiltIn: true,
      isActive: true,
    },
  ]

  for (const rule of SENSITIVITY_RULES) {
    await prisma.sensitivityRule.upsert({
      where: { id: rule.id },
      update: { ...rule },
      create: { ...rule },
    })
  }

  console.log(`Seeded ${SENSITIVITY_RULES.length} sensitivity rules.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
