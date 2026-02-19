import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { getMCPTools } from './client'

export interface AnthropicTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export async function getAnthropicTools(mcpClient: Client): Promise<AnthropicTool[]> {
  const mcpTools = await getMCPTools(mcpClient)

  return mcpTools.map((tool) => ({
    name: tool.name,
    description: tool.description || '',
    input_schema: tool.inputSchema as Record<string, unknown>,
  }))
}
