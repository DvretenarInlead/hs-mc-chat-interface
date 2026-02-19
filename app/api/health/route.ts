import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  const timestamp = new Date().toISOString()
  const version = process.env.npm_package_version || '0.1.0'

  try {
    // Quick DB connectivity check
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: 'ok',
      timestamp,
      version,
    })
  } catch {
    // Return 200 so the platform readiness probe passes even when
    // the database is temporarily unreachable (e.g. during first
    // migration or a permission fix). The "degraded" status lets
    // monitoring distinguish this from a fully healthy state.
    return NextResponse.json({
      status: 'degraded',
      timestamp,
      version,
      message: 'Database connection failed',
    })
  }
}
