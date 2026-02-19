import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, destroySession, clearSessionCookie } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)

  // Even if the session is invalid, clear the cookie
  const cookieHeader = request.headers.get('cookie') || ''
  const sessionToken = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('ri_session='))
    ?.split('=')
    .slice(1)
    .join('=')

  if (sessionToken) {
    await destroySession(sessionToken)
  }

  await clearSessionCookie()

  const response = NextResponse.json({ success: true })
  response.cookies.delete('ri_session')
  return response
}
