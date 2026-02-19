'use client'

import { useState, useCallback, FormEvent } from 'react'
import Modal from '@/components/ui/Modal'

interface SetPinDialogProps {
  isOpen: boolean
  onClose: () => void
  hasExistingPin: boolean
}

export default function SetPinDialog({ isOpen, onClose, hasExistingPin }: SetPinDialogProps) {
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [mode, setMode] = useState<'set' | 'remove'>(hasExistingPin ? 'set' : 'set')

  const resetForm = useCallback(() => {
    setCurrentPin('')
    setNewPin('')
    setConfirmPin('')
    setError(null)
    setSuccess(false)
    setLoading(false)
  }, [])

  const handleClose = useCallback(() => {
    resetForm()
    onClose()
  }, [onClose, resetForm])

  const handleSetPin = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return

    if (newPin !== confirmPin) {
      setError('PINs do not match')
      return
    }

    if (newPin.length < 4 || newPin.length > 8 || !/^\d+$/.test(newPin)) {
      setError('PIN must be 4-8 digits')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const body: Record<string, string> = { pin: newPin }
      if (hasExistingPin && currentPin) {
        body.currentPin = currentPin
      }

      const res = await fetch('/api/auth/chat-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess(true)
        setTimeout(handleClose, 1500)
      } else {
        setError(data.error || 'Failed to set PIN')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [loading, newPin, confirmPin, currentPin, hasExistingPin, handleClose])

  const handleRemovePin = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/chat-pin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', currentPin }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess(true)
        setTimeout(handleClose, 1500)
      } else {
        setError(data.error || 'Failed to remove PIN')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [loading, currentPin, handleClose])

  if (success) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Chat PIN">
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-gray-700">
            {mode === 'remove' ? 'PIN removed successfully' : 'PIN updated successfully'}
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={hasExistingPin ? 'Change Chat PIN' : 'Set Chat PIN'}>
      <div className="space-y-4">
        {hasExistingPin && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => { setMode('set'); setError(null) }}
              className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                mode === 'set' ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Change PIN
            </button>
            <button
              onClick={() => { setMode('remove'); setError(null) }}
              className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                mode === 'remove' ? 'bg-red-100 text-red-700 font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Remove PIN
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {mode === 'remove' ? (
          <form onSubmit={handleRemovePin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current PIN</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter current PIN"
                className="w-full px-4 py-2 text-center tracking-[0.3em] border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || currentPin.length < 4}
              className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {loading ? 'Removing...' : 'Remove PIN'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSetPin} className="space-y-4">
            {hasExistingPin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter current PIN"
                  className="w-full px-4 py-2 text-center tracking-[0.3em] border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4-8 digits"
                className="w-full px-4 py-2 text-center tracking-[0.3em] border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus={!hasExistingPin}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Repeat PIN"
                className="w-full px-4 py-2 text-center tracking-[0.3em] border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading || newPin.length < 4 || confirmPin.length < 4}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {loading ? 'Saving...' : hasExistingPin ? 'Change PIN' : 'Set PIN'}
            </button>
          </form>
        )}

        <p className="text-xs text-gray-400 text-center">
          PIN must be 4-8 digits. No repeated or sequential patterns.
        </p>
      </div>
    </Modal>
  )
}
