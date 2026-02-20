const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const DEFAULT_RULES = [
  {
    name: 'Allow CRM Search',
    description: 'Allow all users to search CRM records',
    toolName: 'hubspot_search_crm',
    action: 'ALLOW',
    appliesTo: ['ADMIN', 'POWER_USER', 'VIEWER'],
  },
  {
    name: 'Allow Get CRM Record',
    description: 'Allow all users to view individual CRM records',
    toolName: 'hubspot_get_crm_record',
    action: 'ALLOW',
    appliesTo: ['ADMIN', 'POWER_USER', 'VIEWER'],
  },
  {
    name: 'Allow Admin Create Note',
    description: 'Admins can create notes without confirmation',
    toolName: 'hubspot_create_note',
    action: 'ALLOW',
    appliesTo: ['ADMIN'],
  },
  {
    name: 'Confirm Power User Create Note',
    description: 'Power users must confirm before creating notes',
    toolName: 'hubspot_create_note',
    action: 'REQUIRE_CONFIRM',
    appliesTo: ['POWER_USER'],
  },
  {
    name: 'Block Viewer Create Note',
    description: 'Viewers cannot create notes',
    toolName: 'hubspot_create_note',
    action: 'BLOCK',
    appliesTo: ['VIEWER'],
  },
  {
    name: 'Allow Admin Create Task',
    description: 'Admins can create tasks without confirmation',
    toolName: 'hubspot_create_task',
    action: 'ALLOW',
    appliesTo: ['ADMIN'],
  },
  {
    name: 'Confirm Power User Create Task',
    description: 'Power users must confirm before creating tasks',
    toolName: 'hubspot_create_task',
    action: 'REQUIRE_CONFIRM',
    appliesTo: ['POWER_USER'],
  },
  {
    name: 'Block Viewer Create Task',
    description: 'Viewers cannot create tasks',
    toolName: 'hubspot_create_task',
    action: 'BLOCK',
    appliesTo: ['VIEWER'],
  },
  {
    name: 'Confirm Admin Update Record',
    description: 'Admins must confirm before updating CRM records',
    toolName: 'hubspot_update_crm_record',
    action: 'REQUIRE_CONFIRM',
    appliesTo: ['ADMIN', 'POWER_USER'],
  },
  {
    name: 'Block Viewer Update Record',
    description: 'Viewers cannot update CRM records',
    toolName: 'hubspot_update_crm_record',
    action: 'BLOCK',
    appliesTo: ['VIEWER'],
  },
  {
    name: 'Block All Delete Operations',
    description: 'Delete operations are blocked for all users in MVP',
    toolName: 'hubspot_delete_crm_record',
    action: 'BLOCK',
    appliesTo: ['ADMIN', 'POWER_USER', 'VIEWER'],
  },
]

const SENSITIVITY_RULES = [
  {
    id: 'builtin_email',
    name: 'Email Address',
    description: 'Masks email addresses in chat responses',
    pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    category: 'EMAIL',
    maskStyle: 'PARTIAL',
    isBuiltIn: true,
    isActive: true,
  },
  {
    id: 'builtin_phone',
    name: 'Phone Number (US)',
    description: 'Masks US phone numbers in chat responses',
    pattern: '(?:\\+1[\\s.-]?)?(?:\\(?\\d{3}\\)?[\\s.-]?)\\d{3}[\\s.-]?\\d{4}',
    category: 'PHONE',
    maskStyle: 'PARTIAL',
    isBuiltIn: true,
    isActive: true,
  },
  {
    id: 'builtin_ssn',
    name: 'Social Security Number',
    description: 'Redacts SSN patterns in chat responses',
    pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b',
    category: 'SSN',
    maskStyle: 'REDACT',
    isBuiltIn: true,
    isActive: true,
  },
  {
    id: 'builtin_credit_card',
    name: 'Credit Card Number',
    description: 'Redacts credit card number patterns',
    pattern: '\\b(?:\\d{4}[\\s-]?){3}\\d{4}\\b',
    category: 'CREDIT_CARD',
    maskStyle: 'REDACT',
    isBuiltIn: true,
    isActive: true,
  },
  {
    id: 'builtin_api_key',
    name: 'API Key Pattern',
    description: 'Masks API keys and tokens that may appear in CRM data',
    pattern: '(?:sk|pk|api|key|token|secret)[_-]?[a-zA-Z0-9]{20,}',
    category: 'API_KEY',
    maskStyle: 'FULL',
    isBuiltIn: true,
    isActive: true,
  },
]

async function main() {
  // Seed admin user (user 0)
  console.log('Seeding admin user...')
  await prisma.user.upsert({
    where: { email: 'darian@plusyourbusiness.com' },
    update: {
      role: 'ADMIN',
    },
    create: {
      email: 'darian@plusyourbusiness.com',
      name: 'Darian',
      role: 'ADMIN',
    },
  })
  console.log('Admin user seeded: darian@plusyourbusiness.com')

  // Seed default governance rules
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
  for (const rule of SENSITIVITY_RULES) {
    await prisma.sensitivityRule.upsert({
      where: { id: rule.id },
      update: { ...rule },
      create: { ...rule },
    })
  }
  console.log(`Seeded ${SENSITIVITY_RULES.length} sensitivity rules.`)

  // Seed default data retention policy
  console.log('Seeding default data retention policy...')
  await prisma.dataRetentionPolicy.upsert({
    where: { id: 'default_retention_policy' },
    update: {},
    create: {
      id: 'default_retention_policy',
      chatSessionMaxDays: 90,
      auditLogMaxDays: 365,
      securityEventMaxDays: 365,
      isActive: true,
    },
  })
  console.log('Seeded default data retention policy.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
