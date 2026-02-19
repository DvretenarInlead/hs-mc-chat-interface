import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto'
import { SignJWT, jwtVerify } from 'jose'

const PIN_PBKDF2_ITERATIONS = 100_000
const PIN_HASH_LENGTH = 32
const PIN_MIN_LENGTH = 4
const PIN_MAX_LENGTH = 8
const PIN_UNLOCK_COOKIE = 'ri_chat_unlock'
const PIN_UNLOCK_DURATION = 30 * 60 // 30 minutes in seconds
const PIN_MAX_FAILURES = 5
const PIN_LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes in ms

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export function validatePinFormat(pin: string): { valid: boolean; error?: string } {
  if (typeof pin !== 'string') {
    return { valid: false, error: 'PIN must be a string' }
  }
  if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
    return { valid: false, error: `PIN must be ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} digits` }
  }
  if (!/^\d+$/.test(pin)) {
    return { valid: false, error: 'PIN must contain only digits' }
  }
  // Reject trivially weak PINs
  if (/^(\d)\1+$/.test(pin)) {
    return { valid: false, error: 'PIN cannot be all the same digit' }
  }
  if (isSequential(pin)) {
    return { valid: false, error: 'PIN cannot be a sequential pattern' }
  }
  return { valid: true }
}

function isSequential(pin: string): boolean {
  let ascending = true
  let descending = true
  for (let i = 1; i < pin.length; i++) {
    const diff = parseInt(pin[i]) - parseInt(pin[i - 1])
    if (diff !== 1) ascending = false
    if (diff !== -1) descending = false
  }
  return ascending || descending
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(pin, salt, PIN_PBKDF2_ITERATIONS, PIN_HASH_LENGTH, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

export function verifyPin(pin: string, storedHash: string): boolean {
  const [salt, expectedHash] = storedHash.split(':')
  if (!salt || !expectedHash) return false

  const hash = pbkdf2Sync(pin, salt, PIN_PBKDF2_ITERATIONS, PIN_HASH_LENGTH, 'sha512').toString('hex')

  const hashBuffer = Buffer.from(hash, 'hex')
  const expectedBuffer = Buffer.from(expectedHash, 'hex')
  if (hashBuffer.length !== expectedBuffer.length) return false

  return timingSafeEqual(hashBuffer, expectedBuffer)
}

export async function createChatUnlockToken(userId: string): Promise<string> {
  return new SignJWT({ userId, purpose: 'chat_unlock' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${PIN_UNLOCK_DURATION}s`)
    .setIssuedAt()
    .sign(getSessionSecret())
}

export async function verifyChatUnlockToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret())
    if (payload.purpose !== 'chat_unlock') return null
    return (payload.userId as string) || null
  } catch {
    return null
  }
}

export function isPinLockedOut(lockedUntil: Date | null): boolean {
  if (!lockedUntil) return false
  return lockedUntil > new Date()
}

export function getPinLockoutExpiry(): Date {
  return new Date(Date.now() + PIN_LOCKOUT_DURATION)
}

export { PIN_UNLOCK_COOKIE, PIN_UNLOCK_DURATION, PIN_MAX_FAILURES }
