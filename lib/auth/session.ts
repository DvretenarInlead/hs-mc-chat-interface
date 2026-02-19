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

    if (!name || name.length > 256) return

    try {
      cookies[name] = decodeURIComponent(value)
    } catch {
      cookies[name] = value
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
 * Get decrypted HubSpot access token from the user's assigned portal.
 * Auto-refreshes if the token is about to expire.
 */
export async function getDecryptedToken(user: User): Promise<string> {
  if (!user.portalId) {
    throw new Error('No HubSpot portal assigned. Ask an admin to assign you to a portal.')
  }

  const portal = await prisma.portal.findUnique({ where: { id: user.portalId } })
  if (!portal) {
    throw new Error('Assigned portal not found.')
  }

  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)

  if (portal.tokenExpiresAt < fiveMinutesFromNow) {
    const freshPortal = await prisma.portal.findUnique({ where: { id: portal.id } })
    if (!freshPortal) throw new Error('Portal not found')

    if (freshPortal.tokenExpiresAt >= fiveMinutesFromNow) {
      return decrypt(freshPortal.accessToken)
    }

    const decryptedRefresh = decrypt(freshPortal.refreshToken)
    const newTokens = await refreshAccessToken(decryptedRefresh)

    const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000)
    const updated = await prisma.portal.updateMany({
      where: {
        id: portal.id,
        tokenExpiresAt: freshPortal.tokenExpiresAt,
      },
      data: {
        accessToken: encrypt(newTokens.access_token),
        refreshToken: encrypt(newTokens.refresh_token),
        tokenExpiresAt: expiresAt,
      },
    })

    if (updated.count === 0) {
      const racePortal = await prisma.portal.findUnique({ where: { id: portal.id } })
      if (!racePortal) throw new Error('Portal not found')
      return decrypt(racePortal.accessToken)
    }

    return newTokens.access_token
  }

  return decrypt(portal.accessToken)
}
