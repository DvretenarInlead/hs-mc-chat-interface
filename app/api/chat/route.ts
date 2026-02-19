import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, getDecryptedToken } from '@/lib/auth/session'
import { createMCPClient, closeMCPClient } from '@/lib/mcp/client'
import { getAnthropicTools } from '@/lib/mcp/tool-registry'
import { runClaudeLoop } from '@/lib/claude/tool-handler'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  // 1. Auth check
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Rate limit check
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

  // 3. Parse request body
  let body: { messages: Array<{ role: string; content: string }>; confirmationToken?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { messages, confirmationToken } = body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Messages array is required' }, { status: 400 })
  }

  // 4. Sanitize user messages
  const sanitizedMessages = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: sanitizeInput(m.content),
  }))

  // 5. Set up MCP client and stream response
  let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | null = null
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Get decrypted HubSpot token (auto-refreshes if needed)
        const accessToken = await getDecryptedToken(user)

        // Create MCP client
        mcpClient = await createMCPClient(accessToken)
        const tools = await getAnthropicTools(mcpClient)

        // Run the Claude tool call loop
        await runClaudeLoop({
          user,
          messages: sanitizedMessages,
          tools,
          mcpClient,
          confirmationToken,
          onChunk: (text) => {
            const data = JSON.stringify({ type: 'text', content: text })
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
        // Log only the message, never the full error object (may contain tokens/secrets)
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
  // Remove any null bytes
  let sanitized = input.replace(/\0/g, '')
  // Trim excessive length
  sanitized = sanitized.slice(0, 10000)
  return sanitized
}
