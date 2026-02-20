'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import HubSpotEmbedChat from '@/components/chat/HubSpotEmbedChat'

function EmbedContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  if (!token) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500 text-sm">Missing authentication token.</p>
      </div>
    )
  }

  return <HubSpotEmbedChat embedToken={token} />
}

export default function HubSpotEmbedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      }
    >
      <EmbedContent />
    </Suspense>
  )
}
