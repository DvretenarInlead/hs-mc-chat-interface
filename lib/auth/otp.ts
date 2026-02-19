import { randomInt } from 'crypto'
import { Resend } from 'resend'
import { prisma } from '@/lib/db/prisma'

const OTP_LENGTH = 6
const OTP_EXPIRY_MINUTES = 10
const MAX_OTP_ATTEMPTS = 5
const OTP_COOLDOWN_SECONDS = 60

const ADMIN_DOMAIN = 'plusyourbusiness.com'
const FROM_EMAIL = 'noreply@notifications.plusyourbusiness.com'

let resendClient: Resend | null = null

function getResend(): Resend {
  if (resendClient) return resendClient
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')
  resendClient = new Resend(key)
  return resendClient
}

export function isAdminDomain(email: string): boolean {
  return email.toLowerCase().endsWith(`@${ADMIN_DOMAIN}`)
}

export function generateOtpCode(): string {
  const min = Math.pow(10, OTP_LENGTH - 1)
  const max = Math.pow(10, OTP_LENGTH) - 1
  return String(randomInt(min, max + 1))
}

export async function requestOtp(email: string): Promise<{ success: boolean; error?: string }> {
  // Check cooldown — prevent spamming
  const recentOtp = await prisma.otpCode.findFirst({
    where: {
      email: email.toLowerCase(),
      createdAt: { gt: new Date(Date.now() - OTP_COOLDOWN_SECONDS * 1000) },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (recentOtp) {
    return { success: false, error: 'Please wait before requesting another code.' }
  }

  const code = generateOtpCode()
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

  // Store OTP
  await prisma.otpCode.create({
    data: {
      email: email.toLowerCase(),
      code,
      expiresAt,
    },
  })

  // Send via Resend
  try {
    const resend = getResend()
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email.toLowerCase(),
      subject: 'Your Relationship Intelligence login code',
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a; margin-bottom: 8px;">Login Code</h2>
          <p style="color: #666; margin-bottom: 24px;">Enter this code to sign in to Relationship Intelligence:</p>
          <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1a1a1a;">${code}</span>
          </div>
          <p style="color: #999; font-size: 13px;">This code expires in ${OTP_EXPIRY_MINUTES} minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    })
    return { success: true }
  } catch (err) {
    console.error('[OTP] Failed to send email:', err instanceof Error ? err.message : err)
    return { success: false, error: 'Failed to send verification email.' }
  }
}

export async function verifyOtp(
  email: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase()

  // Find the most recent unused OTP for this email
  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      email: normalizedEmail,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!otpRecord) {
    return { valid: false, error: 'No valid code found. Please request a new one.' }
  }

  // Check max attempts
  if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { used: true },
    })
    return { valid: false, error: 'Too many attempts. Please request a new code.' }
  }

  // Increment attempts
  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { attempts: { increment: 1 } },
  })

  // Constant-time comparison to prevent timing attacks
  if (otpRecord.code.length !== code.length) {
    return { valid: false, error: 'Invalid code.' }
  }

  let mismatch = 0
  for (let i = 0; i < otpRecord.code.length; i++) {
    mismatch |= otpRecord.code.charCodeAt(i) ^ code.charCodeAt(i)
  }

  if (mismatch !== 0) {
    return { valid: false, error: 'Invalid code.' }
  }

  // Mark as used and invalidate all other codes for this email
  await prisma.otpCode.updateMany({
    where: { email: normalizedEmail, used: false },
    data: { used: true },
  })

  return { valid: true }
}
