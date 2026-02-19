'use client'

import { useEffect } from 'react'

export default function CallbackPage() {
  useEffect(() => {
    // This page is just a loading state while the OAuth callback processes
    // The actual callback is handled by /api/auth/callback which redirects
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-500">Completing sign-in...</p>
      </div>
    </div>
  )
}
