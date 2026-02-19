import Anthropic from '@anthropic-ai/sdk'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { User, RuleAction, LogStatus } from '@prisma/client'
import { getAnthropicClient } from './client'
import { buildSystemPrompt } from './system-prompt'
import { evaluateGovernanceRule, isWriteOperation } from '@/lib/governance/rules'
import { createAuditLog, updateAuditLogStatus, classifyToolAction } from '@/lib/db/audit'
import type { AnthropicTool } from '@/lib/mcp/tool-registry'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string | Anthropic.ContentBlock[]
}

interface RunClaudeLoopParams {
  user: User
  messages: ChatMessage[]
  tools: AnthropicTool[]
  mcpClient: Client
  confirmationToken?: string
  onChunk: (text: string) => void
  onToolCallStart: (toolName: string) => void
  onRequiresConfirmation: (data: {
    tool: string
    description: string
    token: string
    toolInput: Record<string, unknown>
  }) => void
  onDone: () => void
}

// Simple token for confirmation flow
export function generateConfirmationToken(toolName: string, input: Record<string, unknown>): string {
  const payload = JSON.stringify({ tool: toolName, input, ts: Date.now() })
  return Buffer.from(payload).toString('base64')
}

export function verifyConfirmationToken(token: string): { tool: string; input: Record<string, unknown> } | null {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString())
    // Tokens expire after 5 minutes
    if (Date.now() - payload.ts > 5 * 60 * 1000) return null
    return { tool: payload.tool, input: payload.input }
  } catch {
    return null
  }
}

export async function runClaudeLoop({
  user,
  messages,
  tools,
  mcpClient,
  confirmationToken,
  onChunk,
  onToolCallStart,
  onRequiresConfirmation,
  onDone,
}: RunClaudeLoopParams) {
  const anthropic = getAnthropicClient()
  const systemPrompt = buildSystemPrompt(user)

  // Convert messages to Anthropic format
  const conversationMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content as string,
  }))

  const MAX_ITERATIONS = 10 // Safety limit on tool call loops

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: conversationMessages,
      tools: tools as Anthropic.Tool[],
    })

    const contentBlocks: Anthropic.ContentBlock[] = []
    let currentToolUse: { id: string; name: string; input: string } | null = null

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'text') {
          contentBlocks.push(event.content_block)
        } else if (event.content_block.type === 'tool_use') {
          currentToolUse = {
            id: event.content_block.id,
            name: event.content_block.name,
            input: '',
          }
          onToolCallStart(event.content_block.name)
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          onChunk(event.delta.text)
        } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
          currentToolUse.input += event.delta.partial_json
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolUse) {
          const toolInput = currentToolUse.input
            ? JSON.parse(currentToolUse.input)
            : {}
          contentBlocks.push({
            type: 'tool_use',
            id: currentToolUse.id,
            name: currentToolUse.name,
            input: toolInput,
          })
          currentToolUse = null
        }
      }
    }

    // Check if there are any tool use blocks
    const toolUseBlocks = contentBlocks.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )

    if (toolUseBlocks.length === 0) {
      // No tool calls — we're done
      onDone()
      return
    }

    // Add assistant message with all content blocks
    conversationMessages.push({
      role: 'assistant',
      content: contentBlocks,
    })

    // Execute each tool call through governance layer
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    let paused = false

    for (const toolUse of toolUseBlocks) {
      const toolInput = toolUse.input as Record<string, unknown>

      // Check governance rules for write operations
      if (isWriteOperation(toolUse.name)) {
        const evaluation = await evaluateGovernanceRule(
          { name: toolUse.name, input: toolInput },
          user.role
        )

        if (evaluation.action === RuleAction.BLOCK) {
          // Log the blocked attempt
          await createAuditLog({
            userId: user.id,
            userEmail: user.email,
            action: classifyToolAction(toolUse.name),
            toolName: toolUse.name,
            inputSummary: JSON.stringify(toolInput).slice(0, 500),
            status: LogStatus.BLOCKED,
          })

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Action blocked by governance policy: ${evaluation.name}. This operation is not permitted for your role.`,
            is_error: true,
          })
          continue
        }

        if (evaluation.action === RuleAction.REQUIRE_CONFIRM && !confirmationToken) {
          // Need user confirmation
          const token = generateConfirmationToken(toolUse.name, toolInput)
          onRequiresConfirmation({
            tool: toolUse.name,
            description: evaluation.confirmationMessage || `Confirm action: ${toolUse.name}`,
            token,
            toolInput,
          })
          paused = true
          break
        }
      }

      // Log the tool call
      const auditLog = await createAuditLog({
        userId: user.id,
        userEmail: user.email,
        action: classifyToolAction(toolUse.name),
        toolName: toolUse.name,
        inputSummary: JSON.stringify(toolInput).slice(0, 500),
        recordType: (toolInput.objectType as string) || undefined,
        recordId: (toolInput.objectId as string) || undefined,
        status: LogStatus.PENDING,
      })

      try {
        // Execute the MCP tool
        const result = await mcpClient.callTool({
          name: toolUse.name,
          arguments: toolInput,
        })

        const resultContent =
          typeof result.content === 'string'
            ? result.content
            : JSON.stringify(result.content)

        // Update audit log
        await updateAuditLogStatus(
          auditLog.id,
          LogStatus.COMPLETED,
          resultContent.slice(0, 1000)
        )

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: resultContent,
        })
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'

        await updateAuditLogStatus(auditLog.id, LogStatus.REJECTED, errorMessage)

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Error executing tool: ${errorMessage}`,
          is_error: true,
        })
      }
    }

    if (paused) {
      onDone()
      return
    }

    // Add tool results to conversation for next loop iteration
    conversationMessages.push({
      role: 'user',
      content: toolResults,
    })

    // Clear confirmation token after first use
    confirmationToken = undefined
  }

  // If we hit the max iterations, end gracefully
  onChunk('\n\n*I reached the maximum number of tool calls for this response. Please ask a follow-up question to continue.*')
  onDone()
}
