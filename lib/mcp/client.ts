import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

export async function createMCPClient(accessToken: string): Promise<Client> {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', '@hubspot/mcp-server'],
    env: {
      ...process.env,
      PRIVATE_APP_ACCESS_TOKEN: accessToken,
    } as Record<string, string>,
  })

  const client = new Client(
    { name: 'relationship-intel-chat', version: '1.0.0' },
    { capabilities: {} }
  )

  await client.connect(transport)
  return client
}

export async function getMCPTools(client: Client) {
  const { tools } = await client.listTools()
  return tools
}

export async function closeMCPClient(client: Client) {
  try {
    await client.close()
  } catch {
    // Silently handle close errors
  }
}
