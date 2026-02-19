'use client'

import { useState, useEffect, useCallback } from 'react'

interface RetentionPolicy {
  id: string
  chatSessionMaxDays: number
  auditLogMaxDays: number
  securityEventMaxDays: number
  isActive: boolean
  lastRunAt: string | null
}

export default function DataRetentionManager() {
  const [policy, setPolicy] = useState<RetentionPolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [chatDays, setChatDays] = useState(90)
  const [auditDays, setAuditDays] = useState(365)
  const [securityDays, setSecurityDays] = useState(365)

  const fetchPolicy = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/retention')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      if (data.policy) {
        setPolicy(data.policy)
        setChatDays(data.policy.chatSessionMaxDays)
        setAuditDays(data.policy.auditLogMaxDays)
        setSecurityDays(data.policy.securityEventMaxDays)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPolicy()
  }, [fetchPolicy])

  const savePolicy = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/admin/retention', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatSessionMaxDays: chatDays,
          auditLogMaxDays: auditDays,
          securityEventMaxDays: securityDays,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSuccess('Retention policy updated successfully')
      await fetchPolicy()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const runNow = async () => {
    if (!confirm('Run data retention cleanup now? This will permanently delete old records.')) return
    setRunning(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/admin/retention', {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to run')
      const data = await res.json()
      setSuccess(`Cleanup complete. Deleted: ${data.chatSessionsDeleted ?? 0} chat sessions, ${data.auditLogsDeleted ?? 0} audit logs, ${data.securityEventsDeleted ?? 0} security events.`)
      await fetchPolicy()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run cleanup')
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Data Retention Policy</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure how long data is kept before automatic purge. Cleanup can be triggered manually or runs on a schedule.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Chat Session Retention (days)
          </label>
          <input
            type="number"
            min={1}
            max={3650}
            value={chatDays}
            onChange={(e) => setChatDays(parseInt(e.target.value) || 90)}
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">Chat sessions older than this will be purged.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Audit Log Retention (days)
          </label>
          <input
            type="number"
            min={1}
            max={3650}
            value={auditDays}
            onChange={(e) => setAuditDays(parseInt(e.target.value) || 365)}
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">Tool execution audit logs older than this will be purged.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Security Event Retention (days)
          </label>
          <input
            type="number"
            min={1}
            max={3650}
            value={securityDays}
            onChange={(e) => setSecurityDays(parseInt(e.target.value) || 365)}
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">Security events (PIN, access logs) older than this will be purged.</p>
        </div>

        {policy?.lastRunAt && (
          <p className="text-xs text-gray-500">
            Last cleanup run: {new Date(policy.lastRunAt).toLocaleString()}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={savePolicy}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Policy'}
          </button>
          <button
            onClick={runNow}
            disabled={running}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {running ? 'Running...' : 'Run Cleanup Now'}
          </button>
        </div>
      </div>
    </div>
  )
}
