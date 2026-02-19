import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { getMCPTools } from './client'
import { isWriteOperation } from '@/lib/governance/rules'

export interface AnthropicTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

/**
 * Check if the app is in read-only mode.
 * Controlled by MCP_MODE env var: "read_only" strips all write tools.
 * Default is "read_write" for backward compatibility.
 */
export function isReadOnlyMode(): boolean {
  return process.env.MCP_MODE === 'read_only'
}

export async function getAnthropicTools(mcpClient: Client): Promise<AnthropicTool[]> {
  const mcpTools = await getMCPTools(mcpClient)
  const readOnly = isReadOnlyMode()

  const tools = mcpTools.map((tool) => ({
    name: tool.name,
    description: tool.description || '',
    input_schema: tool.inputSchema as Record<string, unknown>,
  }))

  if (readOnly) {
    // Strip all write tools — Claude will never even see them
    return tools.filter((t) => !isWriteOperation(t.name))
  }

  return tools
}
