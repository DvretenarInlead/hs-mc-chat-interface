import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

// Allowlist of env vars the MCP subprocess needs (minimise exposure)
const ALLOWED_ENV_KEYS = ['PATH', 'HOME', 'NODE_ENV', 'npm_config_cache']

function buildSafeEnv(accessToken: string): Record<string, string> {
  const safeEnv: Record<string, string> = {
    PRIVATE_APP_ACCESS_TOKEN: accessToken,
  }
  for (const key of ALLOWED_ENV_KEYS) {
    if (process.env[key]) {
      safeEnv[key] = process.env[key]!
    }
  }
  return safeEnv
}

export async function createMCPClient(accessToken: string): Promise<Client> {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', '@hubspot/mcp-server@latest'],
    env: buildSafeEnv(accessToken),
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
