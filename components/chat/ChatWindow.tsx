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

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sendMessage = useCallback(
    async (
      overrideMessages?: Message[],
      confirmationToken?: string
    ) => {
      const messagesToSend = overrideMessages || messages
      setIsLoading(true)
      setError(null)
      setActiveToolCall(null)

      // Create a new assistant message placeholder
      const assistantMessageId = `msg_${Date.now()}_assistant`

      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: 'assistant', content: '' },
      ])

      try {
        abortControllerRef.current = new AbortController()

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
          window.location.href = '/login'
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
              // Skip malformed events
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Request was cancelled
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
    [messages]
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

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Relationship Intelligence
            </h2>
            <p className="text-gray-500 max-w-sm">
              Ask me about your contacts, companies, meeting notes, or anything in your CRM.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-2 text-sm">
              {[
                'Who did we meet at the MIPIM conference?',
                'Show me all contacts from Pfizer',
                'Where is Hannah working now?',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion)
                    inputRef.current?.focus()
                  }}
                  className="text-left px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            role={message.role}
            content={message.content}
          />
        ))}

        {activeToolCall && <ToolCallDisplay toolName={activeToolCall} />}
        {isLoading && !activeToolCall && messages[messages.length - 1]?.content === '' && (
          <TypingIndicator />
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 px-4 py-3 bg-white">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your contacts, companies, or relationships..."
              rows={1}
              className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 pr-12 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 max-h-32"
              style={{ minHeight: '48px' }}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 rounded-xl bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>

      {/* Confirmation dialog */}
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
