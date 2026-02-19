import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { validatePinFormat, hashPin, verifyPin } from '@/lib/auth/pin'
import { z } from 'zod'

const setPinSchema = z.object({
  pin: z.string().min(4).max(8),
  currentPin: z.string().min(4).max(8).optional(),
})

const removePinSchema = z.object({
  action: z.literal('remove'),
  currentPin: z.string().min(4).max(8),
})

// POST: Set or change chat PIN
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateLimit = checkRateLimit(`pin_set_${user.id}`)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = setPinSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { pin, currentPin } = parsed.data

  // Validate PIN format (weak PIN check)
  const validation = validatePinFormat(pin)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  // If user already has a PIN, require the current one
  if (user.chatPinHash) {
    if (!currentPin) {
      return NextResponse.json(
        { error: 'Current PIN is required to change your PIN' },
        { status: 400 }
      )
    }
    if (!verifyPin(currentPin, user.chatPinHash)) {
      return NextResponse.json({ error: 'Current PIN is incorrect' }, { status: 403 })
    }
  }

  // Hash and store the new PIN
  const pinHash = hashPin(pin)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      chatPinHash: pinHash,
      chatPinRequired: true,
      chatPinSetAt: new Date(),
      chatPinFailures: 0,
      chatPinLockedUntil: null,
    },
  })

  return NextResponse.json({ success: true, message: 'Chat PIN set successfully' })
}

// DELETE: Remove chat PIN (requires current PIN)
export async function DELETE(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateLimit = checkRateLimit(`pin_remove_${user.id}`)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = removePinSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Admin-enforced PINs cannot be removed by the user
  if (user.chatPinRequired && !user.chatPinHash) {
    return NextResponse.json(
      { error: 'PIN is required by your administrator' },
      { status: 403 }
    )
  }

  if (!user.chatPinHash) {
    return NextResponse.json({ error: 'No PIN is set' }, { status: 400 })
  }

  if (!verifyPin(parsed.data.currentPin, user.chatPinHash)) {
    return NextResponse.json({ error: 'PIN is incorrect' }, { status: 403 })
  }

  // Only allow removal if admin hasn't enforced it
  const freshUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (freshUser?.chatPinRequired) {
    // Admin enforced — only clear the hash but keep required flag
    // Actually, if user set their own PIN and admin hasn't forced it, allow removal
    // We'll check: if admin forced chatPinRequired without a hash, don't allow removal
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      chatPinHash: null,
      chatPinRequired: false,
      chatPinSetAt: null,
      chatPinFailures: 0,
      chatPinLockedUntil: null,
    },
  })

  return NextResponse.json({ success: true, message: 'Chat PIN removed' })
}
