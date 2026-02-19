import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, getDecryptedToken } from '@/lib/auth/session'
import { createMCPClient, closeMCPClient, getMCPTools } from '@/lib/mcp/client'

// Endpoint to list available MCP tools (for admin governance editor)
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let mcpClient = null
  try {
    const accessToken = await getDecryptedToken(user)
    mcpClient = await createMCPClient(accessToken)
    const tools = await getMCPTools(mcpClient)

    return NextResponse.json({
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
      })),
    })
  } catch (error) {
    console.error('MCP tools error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Failed to connect to HubSpot. Please try again.' },
      { status: 502 }
    )
  } finally {
    if (mcpClient) await closeMCPClient(mcpClient)
  }
}
