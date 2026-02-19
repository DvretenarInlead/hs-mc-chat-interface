'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const errorMessages: Record<string, string> = {
    oauth_error: 'There was a problem authenticating with HubSpot. Please try again.',
    no_code: 'No authorization code received. Please try again.',
    invalid_state: 'Invalid request. Please try again.',
    auth_failed: 'Authentication failed. Please try again.',
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Relationship Intelligence
          </h1>
          <p className="text-gray-500 mt-2">
            Sign in to access your CRM chat assistant
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errorMessages[error] || 'An error occurred. Please try again.'}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <a
            href="/api/auth/hubspot"
            className="flex items-center justify-center gap-3 w-full rounded-lg bg-[#ff7a59] text-white px-6 py-3 font-medium hover:bg-[#ff5c35] transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984v-.066A2.2 2.2 0 0017.23.833h-.066a2.2 2.2 0 00-2.2 2.2v.067c0 .87.513 1.617 1.25 1.971v2.86a5.884 5.884 0 00-2.627 1.476l-6.95-5.41a2.635 2.635 0 00.076-.612A2.62 2.62 0 004.093.762a2.62 2.62 0 00-2.62 2.622 2.62 2.62 0 002.62 2.622c.47 0 .91-.13 1.29-.349l6.833 5.323a5.9 5.9 0 00-.483 2.343c0 .866.192 1.686.528 2.428l-2.065 2.065a2.07 2.07 0 00-.602-.094 2.084 2.084 0 100 4.168 2.084 2.084 0 002.084-2.084c0-.213-.04-.417-.094-.613l2.012-2.012a5.882 5.882 0 003.607 1.232 5.9 5.9 0 005.9-5.9 5.9 5.9 0 00-5.042-5.832z" />
            </svg>
            Sign in with HubSpot
          </a>

          <p className="text-center text-xs text-gray-400 mt-4">
            You&apos;ll be redirected to HubSpot to sign in with your account.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
