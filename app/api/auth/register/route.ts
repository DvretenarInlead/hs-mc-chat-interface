import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { isAdminDomain } from '@/lib/auth/otp'
import { UserRole } from '@prisma/client'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100).trim(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { email, name } = parsed.data
  const normalizedEmail = email.toLowerCase()

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    return NextResponse.json(
      { error: 'An account with this email already exists. Please sign in.' },
      { status: 409 }
    )
  }

  // Auto-assign ADMIN role to plusyourbusiness.com domain
  const role = isAdminDomain(normalizedEmail) ? UserRole.ADMIN : UserRole.VIEWER

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name,
      role,
    },
  })

  console.log('[Register] User created:', { id: user.id, email: user.email, role: user.role })

  return NextResponse.json({
    success: true,
    message: 'Account created. You can now sign in.',
  })
}
