'use client'

import { useState, useEffect, useCallback } from 'react'
import Badge from '@/components/ui/Badge'

interface SecurityEvent {
  id: string
  userId: string | null
  userEmail: string | null
  eventType: string
  detail: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const EVENT_BADGE_VARIANT: Record<string, 'error' | 'warning' | 'success' | 'info' | 'default'> = {
  PIN_FAILED: 'error',
  PIN_LOCKED_OUT: 'error',
  IP_BLOCKED: 'error',
  BULK_ACCESS_BLOCKED: 'error',
  EXPORT_BLOCKED: 'error',
  PIN_VERIFIED: 'success',
  CHAT_UNLOCKED: 'success',
  PIN_SET: 'info',
  PIN_CHANGED: 'info',
  PIN_UNLOCKED: 'info',
  PIN_RESET_BY_ADMIN: 'warning',
  PIN_REMOVED: 'warning',
  CHAT_LOCKED: 'default',
  SESSION_EXPIRED: 'default',
}

export default function SecurityEventViewer() {
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (filter) params.set('eventType', filter)
      const res = await fetch(`/api/admin/security-events?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setEvents(data.events)
      setPagination(data.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [page, filter])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Security Events</h2>
        <p className="text-sm text-gray-500 mt-1">
          View security-related events including PIN attempts, IP blocks, and access control events.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex items-center gap-3">
        <select
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Events</option>
          <option value="PIN_VERIFIED">PIN Verified</option>
          <option value="PIN_FAILED">PIN Failed</option>
          <option value="PIN_LOCKED_OUT">PIN Locked Out</option>
          <option value="PIN_SET">PIN Set</option>
          <option value="PIN_CHANGED">PIN Changed</option>
          <option value="PIN_RESET_BY_ADMIN">PIN Reset by Admin</option>
          <option value="PIN_UNLOCKED">PIN Unlocked</option>
          <option value="PIN_REMOVED">PIN Removed</option>
          <option value="CHAT_LOCKED">Chat Locked</option>
          <option value="IP_BLOCKED">IP Blocked</option>
          <option value="BULK_ACCESS_BLOCKED">Bulk Access Blocked</option>
          <option value="EXPORT_BLOCKED">Export Blocked</option>
        </select>
        {pagination && (
          <span className="text-sm text-gray-500">
            {pagination.total} event(s)
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : events.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No security events found.</p>
      ) : (
        <>
          <div className="rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Event</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Detail</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(event.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={EVENT_BADGE_VARIANT[event.eventType] || 'default'}>
                        {event.eventType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {event.userEmail || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 max-w-xs truncate">
                      {event.detail}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">
                      {event.ipAddress || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="px-3 py-1 rounded text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
