import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifyOtp } from '@/lib/auth/otp'
import { createSession } from '@/lib/auth/session'
import { logSecurityEvent, getClientIp, getUserAgent } from '@/lib/security/audit-events'
import { z } from 'zod'

const otpVerifySchema = z.object({
  email: z.string().email().max(255),
  code: z.string().length(6).regex(/^\d+$/),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = otpVerifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please enter a valid 6-digit code.' },
      { status: 400 }
    )
  }

  const email = parsed.data.email.toLowerCase()
  const { code } = parsed.data

  // Check if user exists
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ error: 'Invalid code.' }, { status: 401 })
  }

  const result = await verifyOtp(email, code)

  if (!result.valid) {
    await logSecurityEvent({
      userId: user.id,
      userEmail: user.email,
      eventType: 'OTP_FAILED',
      detail: `OTP verification failed: ${result.error}`,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    })
    return NextResponse.json({ error: result.error }, { status: 401 })
  }

  // Create session
  const sessionToken = await createSession(user.id)

  await logSecurityEvent({
    userId: user.id,
    userEmail: user.email,
    eventType: 'OTP_VERIFIED',
    detail: 'OTP verified, session created',
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  })

  const response = NextResponse.json({ success: true })
  response.cookies.set('ri_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60,
    path: '/',
  })

  return response
}
