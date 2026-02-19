import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

// GET — list user's chat sessions (sidebar)
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sessions = await prisma.chatSession.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ sessions })
}

const createSchema = z.object({
  title: z.string().min(1).max(200).optional(),
})

// POST — create a new chat session
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    // Empty body is OK — title is optional
  }

  const parsed = createSchema.safeParse(body)
  const title = parsed.success ? parsed.data.title : undefined

  const session = await prisma.chatSession.create({
    data: {
      userId: user.id,
      title: title || 'New chat',
      messages: [] as Prisma.InputJsonValue,
    },
    select: { id: true, title: true, createdAt: true },
  })

  return NextResponse.json({ session }, { status: 201 })
}

const updateSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
})

// PUT — update a chat session (title or messages)
export async function PUT(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error' }, { status: 400 })
  }

  const { id, title, messages } = parsed.data

  // Verify ownership
  const existing = await prisma.chatSession.findFirst({
    where: { id, userId: user.id },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (title) data.title = title
  if (messages) data.messages = messages as Prisma.InputJsonValue

  const session = await prisma.chatSession.update({
    where: { id },
    data,
    select: { id: true, title: true, updatedAt: true },
  })

  return NextResponse.json({ session })
}

// DELETE — delete a chat session
export async function DELETE(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
  }

  // Verify ownership
  const existing = await prisma.chatSession.findFirst({
    where: { id, userId: user.id },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  await prisma.chatSession.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
