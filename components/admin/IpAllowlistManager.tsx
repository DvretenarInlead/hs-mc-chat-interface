'use client'

import { useState, useEffect, useCallback } from 'react'
import Badge from '@/components/ui/Badge'

interface IpEntry {
  id: string
  cidr: string
  label: string | null
  isActive: boolean
  createdAt: string
}

export default function IpAllowlistManager() {
  const [entries, setEntries] = useState<IpEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newCidr, setNewCidr] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ip-allowlist')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setEntries(data.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const addEntry = async () => {
    if (!newCidr.trim()) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/ip-allowlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cidr: newCidr.trim(), label: newLabel.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add')
      }
      setNewCidr('')
      setNewLabel('')
      await fetchEntries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setAdding(false)
    }
  }

  const toggleEntry = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/admin/ip-allowlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      })
      if (!res.ok) throw new Error('Failed to update')
      await fetchEntries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const deleteEntry = async (id: string) => {
    if (!confirm('Remove this IP allowlist entry?')) return
    try {
      const res = await fetch('/api/admin/ip-allowlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Failed to delete')
      await fetchEntries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
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
        <h2 className="text-lg font-semibold text-gray-900">IP Allowlist</h2>
        <p className="text-sm text-gray-500 mt-1">
          Restrict chat access to specific IP addresses or CIDR ranges. When no entries exist, all IPs are allowed.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Add new entry */}
      <div className="mb-6 rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Add IP Range</h3>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={newCidr}
            onChange={(e) => setNewCidr(e.target.value)}
            placeholder="e.g. 192.168.1.0/24"
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (optional)"
            className="flex-1 min-w-[150px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={addEntry}
            disabled={adding || !newCidr.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>

      {/* Entries list */}
      {entries.length === 0 ? (
        <p className="text-center text-gray-500 py-8">
          No IP allowlist entries. All IPs are currently allowed.
        </p>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">IP/CIDR</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Label</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{entry.cidr}</td>
                  <td className="px-4 py-3 text-gray-500">{entry.label || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={entry.isActive ? 'success' : 'default'}>
                      {entry.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleEntry(entry.id, !entry.isActive)}
                        className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        {entry.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
