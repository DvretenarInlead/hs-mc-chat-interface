'use client'

import { useState, useEffect, useCallback, useRef, FormEvent } from 'react'

interface ChatPinGateProps {
  children: React.ReactNode
}

interface LockStatus {
  pinRequired: boolean
  locked: boolean
  pinSet: boolean
  lockedOut: boolean
  lockoutRemainingMs?: number
}

export default function ChatPinGate({ children }: ChatPinGateProps) {
  const [status, setStatus] = useState<LockStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [settingPin, setSettingPin] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [confirmNewPin, setConfirmNewPin] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/chat-lock-status')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch {
      // Default to unlocked if check fails
      setStatus({ pinRequired: false, locked: false, pinSet: false, lockedOut: false })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  useEffect(() => {
    if (status?.locked && !status.lockedOut && inputRef.current) {
      inputRef.current.focus()
    }
  }, [status])

  const handleVerifyPin = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!pin.trim() || verifying) return

    setVerifying(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })

      const data = await res.json()

      if (res.ok) {
        setPin('')
        await checkStatus()
      } else {
        setError(data.error || 'Incorrect PIN')
        setPin('')
        inputRef.current?.focus()
      }
    } catch {
      setError('Failed to verify PIN. Please try again.')
    } finally {
      setVerifying(false)
    }
  }, [pin, verifying, checkStatus])

  const handleSetNewPin = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!newPin || !confirmNewPin || verifying) return

    if (newPin !== confirmNewPin) {
      setError('PINs do not match')
      return
    }

    if (newPin.length < 4 || newPin.length > 8 || !/^\d+$/.test(newPin)) {
      setError('PIN must be 4-8 digits')
      return
    }

    setVerifying(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/chat-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin }),
      })

      const data = await res.json()

      if (res.ok) {
        setNewPin('')
        setConfirmNewPin('')
        setSettingPin(false)
        await checkStatus()
      } else {
        setError(data.error || 'Failed to set PIN')
      }
    } catch {
      setError('Failed to set PIN. Please try again.')
    } finally {
      setVerifying(false)
    }
  }, [newPin, confirmNewPin, verifying, checkStatus])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  // No PIN required — show chat directly
  if (!status?.pinRequired && !status?.locked) {
    return <>{children}</>
  }

  // PIN required but not set — user needs to create one first
  if (status.pinRequired && !status.pinSet) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="w-full max-w-sm mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">Set Up Your Chat PIN</h2>
            <p className="text-sm text-gray-500 mb-6">
              Your administrator requires a PIN to access chat. Please create a 4-8 digit PIN.
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSetNewPin} className="space-y-4">
              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter new PIN"
                  className="w-full px-4 py-3 text-center text-lg tracking-[0.5em] border border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={confirmNewPin}
                  onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Confirm PIN"
                  className="w-full px-4 py-3 text-center text-lg tracking-[0.5em] border border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={verifying || newPin.length < 4 || confirmNewPin.length < 4}
                className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                {verifying ? 'Setting PIN...' : 'Set PIN'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Locked out
  if (status.lockedOut) {
    const minutes = status.lockoutRemainingMs
      ? Math.ceil(status.lockoutRemainingMs / 60000)
      : 15
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="w-full max-w-sm mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Chat Access Locked</h2>
            <p className="text-sm text-gray-500">
              Too many failed PIN attempts. Please try again in {minutes} minute(s), or contact your administrator.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Chat is locked — show PIN entry
  if (status.locked) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="w-full max-w-sm mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">Enter Chat PIN</h2>
            <p className="text-sm text-gray-500 mb-6">
              Enter your PIN to access CRM chat data.
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleVerifyPin}>
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter PIN"
                className="w-full px-4 py-3 text-center text-lg tracking-[0.5em] border border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-4"
                autoComplete="off"
                autoFocus
              />
              <button
                type="submit"
                disabled={verifying || pin.length < 4}
                className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                {verifying ? 'Verifying...' : 'Unlock Chat'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Unlocked — show children
  return <>{children}</>
}
