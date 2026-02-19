import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  verifyPin,
  createChatUnlockToken,
  isPinLockedOut,
  getPinLockoutExpiry,
  PIN_UNLOCK_COOKIE,
  PIN_UNLOCK_DURATION,
  PIN_MAX_FAILURES,
} from '@/lib/auth/pin'
import { logSecurityEvent, getClientIp, getUserAgent } from '@/lib/security/audit-events'
import { z } from 'zod'

const verifyPinSchema = z.object({
  pin: z.string().min(4).max(8),
})

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Stricter rate limiting for PIN verification (10 per minute)
  const rateLimit = checkRateLimit(`pin_verify_${user.id}`)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please wait.' }, { status: 429 })
  }

  // Check lockout
  if (isPinLockedOut(user.chatPinLockedUntil)) {
    const remainingMs = user.chatPinLockedUntil!.getTime() - Date.now()
    const remainingMin = Math.ceil(remainingMs / 60000)
    return NextResponse.json(
      { error: `Account locked due to too many failed attempts. Try again in ${remainingMin} minute(s).` },
      { status: 423 }
    )
  }

  if (!user.chatPinHash) {
    return NextResponse.json({ error: 'No PIN is set' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = verifyPinSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const isValid = verifyPin(parsed.data.pin, user.chatPinHash)

  const clientIp = getClientIp(request)
  const ua = getUserAgent(request)

  if (!isValid) {
    const newFailures = user.chatPinFailures + 1
    const updateData: Record<string, unknown> = { chatPinFailures: newFailures }

    if (newFailures >= PIN_MAX_FAILURES) {
      updateData.chatPinLockedUntil = getPinLockoutExpiry()
      await logSecurityEvent({
        userId: user.id,
        userEmail: user.email,
        eventType: 'PIN_LOCKED_OUT',
        detail: `User locked out after ${PIN_MAX_FAILURES} failed PIN attempts`,
        ipAddress: clientIp,
        userAgent: ua,
      })
    } else {
      await logSecurityEvent({
        userId: user.id,
        userEmail: user.email,
        eventType: 'PIN_FAILED',
        detail: `Failed PIN attempt (${newFailures}/${PIN_MAX_FAILURES})`,
        ipAddress: clientIp,
        userAgent: ua,
      })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    })

    const attemptsLeft = PIN_MAX_FAILURES - newFailures
    if (attemptsLeft > 0) {
      return NextResponse.json(
        { error: `Incorrect PIN. ${attemptsLeft} attempt(s) remaining.` },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: 'Too many failed attempts. Your chat access has been temporarily locked.' },
      { status: 423 }
    )
  }

  // PIN is correct — reset failures and create unlock token
  await prisma.user.update({
    where: { id: user.id },
    data: { chatPinFailures: 0, chatPinLockedUntil: null },
  })

  await logSecurityEvent({
    userId: user.id,
    userEmail: user.email,
    eventType: 'PIN_VERIFIED',
    detail: 'Chat PIN verified successfully',
    ipAddress: clientIp,
    userAgent: ua,
  })

  const unlockToken = await createChatUnlockToken(user.id)

  const response = NextResponse.json({ success: true })
  response.cookies.set(PIN_UNLOCK_COOKIE, unlockToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: PIN_UNLOCK_DURATION,
    path: '/',
  })

  return response
}
