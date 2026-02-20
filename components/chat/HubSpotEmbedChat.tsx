'use client'

import { useState, useRef, useEffect, useCallback, FormEvent } from 'react'
import MessageBubble from './MessageBubble'
import ToolCallDisplay from './ToolCallDisplay'
import WriteConfirmDialog from './WriteConfirmDialog'
import TypingIndicator from './TypingIndicator'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ConfirmationData {
  tool: string
  description: string
  token: string
}

interface CrmContext {
  objectId: string
  objectType: string
  portalName: string
  hubspotPortalId: string
}

interface Props {
  embedToken: string
}

export default function HubSpotEmbedChat({ embedToken }: Props) {
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [crmContext, setCrmContext] = useState<CrmContext | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Exchange embed token for session on mount
  useEffect(() => {
    let cancelled = false
    async function authenticate() {
      try {
        const res = await fetch('/api/hubspot/embed-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: embedToken }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Authentication failed')
        }
        const data = await res.json()
        if (!cancelled) {
          setSessionToken(data.sessionToken)
          setCrmContext(data.context)
        }
      } catch (err) {
        if (!cancelled) {
          setAuthError(err instanceof Error ? err.message : 'Authentication failed')
        }
      }
    }
    authenticate()
    return () => { cancelled = true }
  }, [embedToken])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (sessionToken) inputRef.current?.focus()
  }, [sessionToken])

  const sendMessage = useCallback(
    async (overrideMessages?: Message[], confirmationToken?: string) => {
      if (!sessionToken) return
      const messagesToSend = overrideMessages || messages
      setIsLoading(true)
      setError(null)
      setActiveToolCall(null)

      const assistantMessageId = `msg_${Date.now()}_assistant`
      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: 'assistant', content: '' },
      ])

      try {
        abortControllerRef.current = new AbortController()

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            messages: messagesToSend.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            confirmationToken,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (response.status === 401) {
          setAuthError('Session expired. Please close and reopen from HubSpot.')
          return
        }

        if (response.status === 429) {
          setError("You've sent too many messages. Please wait a moment.")
          setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId))
          setIsLoading(false)
          return
        }

        if (!response.ok || !response.body) {
          throw new Error('Failed to get response')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6)

            try {
              const event = JSON.parse(jsonStr)

              switch (event.type) {
                case 'text':
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, content: m.content + event.content }
                        : m
                    )
                  )
                  break
                case 'tool_start':
                  setActiveToolCall(event.tool)
                  break
                case 'requires_confirmation':
                  setConfirmation({
                    tool: event.tool,
                    description: event.description,
                    token: event.token,
                  })
                  break
                case 'error':
                  setError(event.content)
                  break
                case 'done':
                  setActiveToolCall(null)
                  break
              }
            } catch {
              // skip malformed events
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // cancelled
        } else {
          setError('An error occurred. Please try again.')
          setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId))
        }
      } finally {
        setIsLoading(false)
        setActiveToolCall(null)
        abortControllerRef.current = null
      }
    },
    [messages, sessionToken]
  )

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      const trimmed = input.trim()
      if (!trimmed || isLoading) return

      const userMessage: Message = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: trimmed,
      }

      const updatedMessages = [...messages, userMessage]
      setMessages(updatedMessages)
      setInput('')
      sendMessage(updatedMessages)
    },
    [input, isLoading, messages, sendMessage]
  )

  const handleConfirm = useCallback(() => {
    if (!confirmation) return
    const token = confirmation.token
    setConfirmation(null)
    sendMessage(messages, token)
  }, [confirmation, messages, sendMessage])

  const handleCancelConfirmation = useCallback(() => {
    setConfirmation(null)
    const cancelMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: 'I cancelled the action. No changes were made.',
    }
    setMessages((prev) => [...prev, cancelMessage])
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit(e as unknown as FormEvent)
      }
    },
    [handleSubmit]
  )

  // Close the HubSpot iframe modal
  const handleClose = useCallback(() => {
    window.parent.postMessage(JSON.stringify({ action: 'DONE' }), '*')
  }, [])

  // Loading state while authenticating
  if (authError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3 px-4">
        <div className="text-red-500 text-sm text-center">{authError}</div>
        <button
          onClick={handleClose}
          className="text-sm text-blue-600 hover:underline"
        >
          Close
        </button>
      </div>
    )
  }

  if (!sessionToken || !crmContext) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="text-sm text-gray-500">Connecting to CRM...</p>
        </div>
      </div>
    )
  }

  const objectLabel = crmContext.objectType.replace(/s$/, '').replace(/^./, (c) => c.toUpperCase())

  return (
    <div className="flex flex-col h-screen">
      {/* Compact header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-900 truncate">
            Relationship Intelligence
          </span>
          <span className="text-xs text-gray-400 hidden sm:inline">
            {objectLabel} #{crmContext.objectId}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 p-1"
          title="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Ask about this {objectLabel.toLowerCase()}
            </h2>
            <p className="text-gray-500 text-sm max-w-xs">
              I have access to your CRM. Ask me anything about this record, related contacts, or activities.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-1.5 text-sm w-full max-w-sm">
              {[
                `Summarize this ${objectLabel.toLowerCase()}'s history`,
                'Show recent activities and notes',
                'What deals are associated with this record?',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion)
                    inputRef.current?.focus()
                  }}
                  className="text-left px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors text-xs"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} role={message.role} content={message.content} />
        ))}

        {activeToolCall && <ToolCallDisplay toolName={activeToolCall} />}
        {isLoading && !activeToolCall && messages[messages.length - 1]?.content === '' && (
          <TypingIndicator />
        )}

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline hover:no-underline">
              Dismiss
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 px-4 py-2 bg-white">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask about this ${objectLabel.toLowerCase()}...`}
              rows={1}
              className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 max-h-24"
              style={{ minHeight: '40px' }}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 rounded-xl bg-blue-600 px-3 py-2.5 text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>

      <WriteConfirmDialog
        isOpen={!!confirmation}
        toolName={confirmation?.tool || ''}
        description={confirmation?.description || ''}
        onConfirm={handleConfirm}
        onCancel={handleCancelConfirmation}
      />
    </div>
  )
}
