import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, getDecryptedToken } from '@/lib/auth/session'
import { createMCPClient, closeMCPClient } from '@/lib/mcp/client'
import { getAnthropicTools } from '@/lib/mcp/tool-registry'
import { runClaudeLoop } from '@/lib/claude/tool-handler'
import { checkRateLimit } from '@/lib/rate-limit'
import { verifyChatUnlockToken, PIN_UNLOCK_COOKIE, isPinLockedOut } from '@/lib/auth/pin'
import { loadSensitivityRules, applyDataMasking } from '@/lib/security/data-masking'
import { loadSensitiveFieldRules, applyFieldMasking } from '@/lib/security/field-sensitivity'
import { isIpAllowed } from '@/lib/security/ip-allowlist'
import { logSecurityEvent, getClientIp, getUserAgent } from '@/lib/security/audit-events'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 60

// Export control: max messages per single request to prevent bulk extraction
const MAX_MESSAGES_PER_REQUEST = 100
// Export control: max total content length in a single request
const MAX_CONTENT_LENGTH = 500_000

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(10000),
      })
    )
    .min(1)
    .max(MAX_MESSAGES_PER_REQUEST),
  confirmationToken: z.string().max(5000).optional(),
})

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)
  const userAgent = getUserAgent(request)

  // 1. Auth check
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. IP allowlist check
  const ipAllowed = await isIpAllowed(clientIp)
  if (!ipAllowed) {
    await logSecurityEvent({
      userId: user.id,
      userEmail: user.email,
      eventType: 'IP_BLOCKED',
      detail: `Chat access blocked for IP ${clientIp}`,
      ipAddress: clientIp,
      userAgent,
    })
    return NextResponse.json(
      { error: 'Access denied from your current network.' },
      { status: 403 }
    )
  }

  // 3. Chat PIN verification — if user has PIN required, check unlock cookie
  if (user.chatPinRequired && user.chatPinHash) {
    if (isPinLockedOut(user.chatPinLockedUntil)) {
      return NextResponse.json(
        { error: 'Chat access is temporarily locked due to too many failed PIN attempts.' },
        { status: 423 }
      )
    }
    const cookieHeader = request.headers.get('cookie') || ''
    const unlockToken = parseCookieFromHeader(cookieHeader, PIN_UNLOCK_COOKIE)
    if (!unlockToken) {
      return NextResponse.json(
        { error: 'Chat PIN verification required', code: 'PIN_REQUIRED' },
        { status: 403 }
      )
    }
    const tokenUserId = await verifyChatUnlockToken(unlockToken)
    if (tokenUserId !== user.id) {
      return NextResponse.json(
        { error: 'Chat PIN verification required', code: 'PIN_REQUIRED' },
        { status: 403 }
      )
    }
  }

  // 4. Rate limit check
  const rateLimit = checkRateLimit(user.id)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "You've sent too many messages. Please wait a moment." },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimit.resetAt),
        },
      }
    )
  }

  // 5. Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = chatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { messages, confirmationToken } = parsed.data

  // 6. Export control: check total content length to prevent bulk extraction
  const totalContentLength = messages.reduce((acc, m) => acc + m.content.length, 0)
  if (totalContentLength > MAX_CONTENT_LENGTH) {
    await logSecurityEvent({
      userId: user.id,
      userEmail: user.email,
      eventType: 'BULK_ACCESS_BLOCKED',
      detail: `Blocked request with ${totalContentLength} chars across ${messages.length} messages`,
      ipAddress: clientIp,
      userAgent,
    })
    return NextResponse.json(
      { error: 'Request too large. Please reduce message history.' },
      { status: 413 }
    )
  }

  // 7. Sanitize user messages
  const sanitizedMessages = messages.map((m) => ({
    role: m.role,
    content: sanitizeInput(m.content),
  }))

  // 8. Set up MCP client and stream response
  let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | null = null
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Verify user has a portal assigned
        if (!user.portalId) {
          const data = JSON.stringify({
            type: 'error',
            content: 'No HubSpot portal assigned to your account. Ask an admin to assign you to a portal.',
          })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          return
        }

        // Get decrypted HubSpot token from portal (auto-refreshes if needed)
        const accessToken = await getDecryptedToken(user)

        // Create MCP client
        mcpClient = await createMCPClient(accessToken)
        const tools = await getAnthropicTools(mcpClient)

        // Load masking rules
        const [sensitivityRules, fieldRules] = await Promise.all([
          loadSensitivityRules(),
          loadSensitiveFieldRules(),
        ])

        // Run the Claude tool call loop
        await runClaudeLoop({
          user,
          messages: sanitizedMessages,
          tools,
          mcpClient,
          confirmationToken,
          onChunk: (text) => {
            // Apply role-based PII masking
            let masked = applyDataMasking(text, sensitivityRules, user.role)
            // Apply per-field sensitivity masking
            masked = applyFieldMasking(masked, fieldRules, user.role)
            const data = JSON.stringify({ type: 'text', content: masked })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          },
          onToolCallStart: (toolName) => {
            const data = JSON.stringify({ type: 'tool_start', tool: toolName })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          },
          onRequiresConfirmation: (confirmData) => {
            const data = JSON.stringify({
              type: 'requires_confirmation',
              ...confirmData,
            })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          },
          onDone: () => {
            const data = JSON.stringify({ type: 'done' })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          },
        })
      } catch (error) {
        console.error(
          'Chat API error:',
          error instanceof Error ? error.message : 'Unknown error'
        )
        const errorMessage =
          error instanceof Error && error.message.includes('token')
            ? 'Your HubSpot session has expired. Please log in again.'
            : 'An error occurred while processing your request. Please try again.'
        const data = JSON.stringify({ type: 'error', content: errorMessage })
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      } finally {
        if (mcpClient) {
          await closeMCPClient(mcpClient)
        }
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-RateLimit-Remaining': String(rateLimit.remaining),
    },
  })
}

function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return ''
  let sanitized = input.replace(/\0/g, '')
  sanitized = sanitized.slice(0, 10000)
  return sanitized
}

function parseCookieFromHeader(cookieHeader: string, name: string): string | undefined {
  if (!cookieHeader) return undefined
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
