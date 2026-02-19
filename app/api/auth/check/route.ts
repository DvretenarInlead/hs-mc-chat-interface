import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// Force dynamic rendering — never cache this at build time
export const dynamic = 'force-dynamic'

export async function GET() {
  const redirectUri = process.env.HUBSPOT_REDIRECT_URI || ''

  let dbStatus = 'unknown'
  try {
    await prisma.$queryRaw`SELECT 1`
    dbStatus = 'connected'
  } catch (e) {
    dbStatus = `error: ${e instanceof Error ? e.message : 'unknown'}`
  }

  return NextResponse.json({
    env: {
      HUBSPOT_CLIENT_ID: !!process.env.HUBSPOT_CLIENT_ID,
      HUBSPOT_CLIENT_SECRET: !!process.env.HUBSPOT_CLIENT_SECRET,
      HUBSPOT_REDIRECT_URI: redirectUri || '(not set)',
      SESSION_SECRET: !!process.env.SESSION_SECRET,
      TOKEN_ENCRYPTION_KEY: !!process.env.TOKEN_ENCRYPTION_KEY,
      DATABASE_URL: !!process.env.DATABASE_URL,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || '(not set)',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '(not set)',
      NODE_ENV: process.env.NODE_ENV || '(not set)',
    },
    database: dbStatus,
    hints: [
      !process.env.HUBSPOT_CLIENT_ID && 'HUBSPOT_CLIENT_ID is missing',
      !process.env.HUBSPOT_CLIENT_SECRET && 'HUBSPOT_CLIENT_SECRET is missing',
      !process.env.HUBSPOT_REDIRECT_URI && 'HUBSPOT_REDIRECT_URI is missing',
      !process.env.SESSION_SECRET && 'SESSION_SECRET is missing',
      !process.env.TOKEN_ENCRYPTION_KEY && 'TOKEN_ENCRYPTION_KEY is missing',
      !process.env.DATABASE_URL && 'DATABASE_URL is missing',
      redirectUri && !redirectUri.includes('/api/auth/callback') && 'HUBSPOT_REDIRECT_URI should end with /api/auth/callback',
      redirectUri && redirectUri.includes('0.0.0.0') && 'HUBSPOT_REDIRECT_URI contains 0.0.0.0 — use your public domain',
      redirectUri && redirectUri.includes('localhost') && process.env.NODE_ENV === 'production' && 'HUBSPOT_REDIRECT_URI contains localhost but NODE_ENV is production',
    ].filter(Boolean),
  })
}
