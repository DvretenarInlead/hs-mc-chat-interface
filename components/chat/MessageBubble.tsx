'use client'

import { useMemo } from 'react'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Lightweight markdown renderer — handles the subset Claude commonly uses.
 * No external deps. Renders bold, italic, code, links, lists, and headers.
 */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let inCodeBlock = false
  let codeBlockContent: string[] = []
  let _codeBlockLang = ''
  let listItems: string[] = []
  let listOrdered = false
  let key = 0

  function flushList() {
    if (listItems.length === 0) return
    const Tag = listOrdered ? 'ol' : 'ul'
    const className = listOrdered
      ? 'list-decimal list-inside space-y-1 my-2'
      : 'list-disc list-inside space-y-1 my-2'
    elements.push(
      <Tag key={key++} className={className}>
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </Tag>
    )
    listItems = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code block toggle
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        flushList()
        inCodeBlock = true
        _codeBlockLang = line.slice(3).trim()
        codeBlockContent = []
        continue
      } else {
        inCodeBlock = false
        elements.push(
          <pre
            key={key++}
            className="bg-gray-800 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-xs"
          >
            <code>{codeBlockContent.join('\n')}</code>
          </pre>
        )
        continue
      }
    }

    if (inCodeBlock) {
      codeBlockContent.push(line)
      continue
    }

    // Unordered list
    if (/^[-*]\s/.test(line)) {
      if (listOrdered && listItems.length > 0) flushList()
      listOrdered = false
      listItems.push(line.replace(/^[-*]\s/, ''))
      continue
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      if (!listOrdered && listItems.length > 0) flushList()
      listOrdered = true
      listItems.push(line.replace(/^\d+\.\s/, ''))
      continue
    }

    // Flush any open list before other block elements
    flushList()

    // Empty line
    if (line.trim() === '') {
      elements.push(<br key={key++} />)
      continue
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={key++} className="text-sm font-bold mt-3 mb-1">
          {renderInline(line.slice(4))}
        </h3>
      )
      continue
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="text-base font-bold mt-3 mb-1">
          {renderInline(line.slice(3))}
        </h2>
      )
      continue
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={key++} className="text-lg font-bold mt-3 mb-1">
          {renderInline(line.slice(2))}
        </h1>
      )
      continue
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={key++} className="my-3 border-current opacity-20" />)
      continue
    }

    // Regular paragraph
    elements.push(
      <p key={key++} className="my-0.5">
        {renderInline(line)}
      </p>
    )
  }

  // Flush unclosed code block
  if (inCodeBlock && codeBlockContent.length > 0) {
    elements.push(
      <pre key={key++} className="bg-gray-800 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-xs">
        <code>{codeBlockContent.join('\n')}</code>
      </pre>
    )
  }

  flushList()

  return elements
}

/**
 * Renders inline markdown: **bold**, *italic*, `code`, [links](url)
 */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold: **text**
    let match = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)$/)
    if (match) {
      if (match[1]) parts.push(<span key={key++}>{match[1]}</span>)
      parts.push(<strong key={key++} className="font-semibold">{match[2]}</strong>)
      remaining = match[3]
      continue
    }

    // Italic: *text*
    match = remaining.match(/^(.*?)\*(.+?)\*(.*)$/)
    if (match) {
      if (match[1]) parts.push(<span key={key++}>{match[1]}</span>)
      parts.push(<em key={key++}>{match[2]}</em>)
      remaining = match[3]
      continue
    }

    // Inline code: `code`
    match = remaining.match(/^(.*?)`(.+?)`(.*)$/)
    if (match) {
      if (match[1]) parts.push(<span key={key++}>{match[1]}</span>)
      parts.push(
        <code key={key++} className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs">
          {match[2]}
        </code>
      )
      remaining = match[3]
      continue
    }

    // Link: [text](url)
    match = remaining.match(/^(.*?)\[(.+?)\]\((.+?)\)(.*)$/)
    if (match) {
      if (match[1]) parts.push(<span key={key++}>{match[1]}</span>)
      parts.push(
        <a
          key={key++}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:no-underline"
        >
          {match[2]}
        </a>
      )
      remaining = match[4]
      continue
    }

    // No more patterns — push remaining text
    parts.push(<span key={key++}>{remaining}</span>)
    break
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}

/**
 * Detect masked/redacted patterns in content to apply copy protection.
 */
function containsMaskedContent(text: string): boolean {
  return /\[RESTRICTED\]|\[REDACTED\]|\*{4,}/.test(text)
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === 'user'
  const hasMasked = useMemo(() => !isUser && containsMaskedContent(content), [content, isUser])
  const rendered = useMemo(
    () => (isUser ? null : renderMarkdown(content)),
    [content, isUser]
  )

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
        }`}
      >
        <div
          className={`text-sm break-words leading-relaxed ${hasMasked ? 'select-none' : ''}`}
          onCopy={hasMasked ? (e) => {
            e.preventDefault()
            e.clipboardData.setData('text/plain', 'Copying restricted content is not allowed.')
          } : undefined}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{content}</span>
          ) : (
            rendered
          )}
        </div>
      </div>
    </div>
  )
}
