import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { requestOtp } from '@/lib/auth/otp'
import { logSecurityEvent, getClientIp, getUserAgent } from '@/lib/security/audit-events'
import { z } from 'zod'

const otpRequestSchema = z.object({
  email: z.string().email().max(255),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = otpRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 }
    )
  }

  const email = parsed.data.email.toLowerCase()

  // Check if user exists
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    // Don't reveal whether the account exists — return success either way
    return NextResponse.json({ success: true })
  }

  const result = await requestOtp(email)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 429 })
  }

  await logSecurityEvent({
    userId: user.id,
    userEmail: user.email,
    eventType: 'OTP_REQUESTED',
    detail: `OTP requested for login`,
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  })

  return NextResponse.json({ success: true })
}
