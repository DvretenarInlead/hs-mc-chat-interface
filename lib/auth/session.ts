import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db/prisma'
import { User } from '@prisma/client'
import { decrypt, encrypt } from './encryption'
import { refreshAccessToken } from './hubspot-oauth'

const SESSION_COOKIE_NAME = 'ri_session'
const SESSION_MAX_AGE = 8 * 60 * 60 // 8 hours in seconds

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function createSession(userId: string): Promise<string> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .setIssuedAt()
    .sign(getSessionSecret())

  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000)

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  })

  return token
}

export async function setSessionCookie(token: string) {
  const cookieStore = cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
}

export async function getSessionFromCookie(): Promise<{ user: User } | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSessionSecret())
    const userId = payload.userId as string

    if (!userId) return null

    // Verify session exists in DB and hasn't expired
    const session = await prisma.session.findFirst({
      where: {
        userId,
        token,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    })

    if (!session) return null

    return { user: session.user }
  } catch {
    return null
  }
}

export async function getUserFromRequest(req: Request): Promise<User | null> {
  // Try to get the session token from the cookie header
  const cookieHeader = req.headers.get('cookie') || ''
  const cookies = parseCookies(cookieHeader)
  const token = cookies[SESSION_COOKIE_NAME]

  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSessionSecret())
    const userId = payload.userId as string

    if (!userId) return null

    const session = await prisma.session.findFirst({
      where: {
        userId,
        token,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    })

    if (!session) return null

    return session.user
  } catch {
    return null
  }
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!cookieHeader) return cookies

  cookieHeader.split(';').forEach((cookie) => {
    const eqIndex = cookie.indexOf('=')
    if (eqIndex === -1) return

    const name = cookie.slice(0, eqIndex).trim()
    const value = cookie.slice(eqIndex + 1).trim()

    if (!name || name.length > 256) return // Reject oversized names

    // Decode percent-encoded values per RFC 6265
    try {
      cookies[name] = decodeURIComponent(value)
    } catch {
      cookies[name] = value // Fallback to raw value if decoding fails
    }
  })
  return cookies
}

export async function destroySession(token: string) {
  await prisma.session.deleteMany({ where: { token } })
}

export async function clearSessionCookie() {
  const cookieStore = cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Get user's decrypted HubSpot access token, refreshing if needed.
 * Uses optimistic locking to prevent concurrent refresh race conditions.
 */
export async function getDecryptedToken(user: User): Promise<string> {
  // Check if token is about to expire (within 5 minutes)
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)

  if (user.tokenExpiresAt < fiveMinutesFromNow) {
    // Re-read the user to check if another request already refreshed
    const freshUser = await prisma.user.findUnique({ where: { id: user.id } })
    if (!freshUser) throw new Error('User not found')

    // If another request already refreshed, use the new token
    if (freshUser.tokenExpiresAt >= fiveMinutesFromNow) {
      return decrypt(freshUser.accessToken)
    }

    // Refresh the token
    const decryptedRefresh = decrypt(freshUser.refreshToken)
    const newTokens = await refreshAccessToken(decryptedRefresh)

    // Update user record with optimistic lock (only if tokenExpiresAt hasn't changed)
    const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000)
    const updated = await prisma.user.updateMany({
      where: {
        id: user.id,
        tokenExpiresAt: freshUser.tokenExpiresAt, // Optimistic lock
      },
      data: {
        accessToken: encrypt(newTokens.access_token),
        refreshToken: encrypt(newTokens.refresh_token),
        tokenExpiresAt: expiresAt,
      },
    })

    // If update count is 0, another request won the race — re-read
    if (updated.count === 0) {
      const raceUser = await prisma.user.findUnique({ where: { id: user.id } })
      if (!raceUser) throw new Error('User not found')
      return decrypt(raceUser.accessToken)
    }

    return newTokens.access_token
  }

  return decrypt(user.accessToken)
}
