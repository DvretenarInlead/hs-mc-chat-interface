import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { verifyChatUnlockToken, PIN_UNLOCK_COOKIE, isPinLockedOut } from '@/lib/auth/pin'
import { logSecurityEvent, getClientIp, getUserAgent } from '@/lib/security/audit-events'

function parseCookieValue(request: NextRequest, name: string): string | undefined {
  const cookieHeader = request.headers.get('cookie') || ''
  const cookies: Record<string, string> = {}
  cookieHeader.split(';').forEach((c) => {
    const eqIdx = c.indexOf('=')
    if (eqIdx === -1) return
    const n = c.slice(0, eqIdx).trim()
    const v = c.slice(eqIdx + 1).trim()
    if (n) cookies[n] = v
  })
  return cookies[name]
}

// GET: Check if chat is locked for the current user
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // If no PIN is required, chat is always unlocked
  if (!user.chatPinRequired || !user.chatPinHash) {
    return NextResponse.json({
      pinRequired: false,
      locked: false,
      pinSet: !!user.chatPinHash,
      lockedOut: false,
    })
  }

  // Check for lockout
  const lockedOut = isPinLockedOut(user.chatPinLockedUntil)
  if (lockedOut) {
    const remainingMs = user.chatPinLockedUntil!.getTime() - Date.now()
    return NextResponse.json({
      pinRequired: true,
      locked: true,
      pinSet: true,
      lockedOut: true,
      lockoutRemainingMs: remainingMs,
    })
  }

  // Check for valid unlock cookie
  const unlockToken = parseCookieValue(request, PIN_UNLOCK_COOKIE)
  if (unlockToken) {
    const tokenUserId = await verifyChatUnlockToken(unlockToken)
    if (tokenUserId === user.id) {
      return NextResponse.json({
        pinRequired: true,
        locked: false,
        pinSet: true,
        lockedOut: false,
      })
    }
  }

  // PIN is required and not unlocked
  return NextResponse.json({
    pinRequired: true,
    locked: true,
    pinSet: true,
    lockedOut: false,
  })
}

// POST: Lock chat immediately (clear unlock cookie)
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await logSecurityEvent({
    userId: user.id,
    userEmail: user.email,
    eventType: 'CHAT_LOCKED',
    detail: 'Chat locked manually by user',
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  })

  const response = NextResponse.json({ success: true, locked: true })
  response.cookies.set(PIN_UNLOCK_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })

  return response
}
