'use client'

import { useState, useEffect, useCallback } from 'react'
import Badge from '@/components/ui/Badge'

interface UserRecord {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'POWER_USER' | 'VIEWER'
  hubspotPortalId: string
  chatPinRequired: boolean
  hasChatPin: boolean
  chatPinFailures: number
  chatPinLockedUntil: string | null
  createdAt: string
}

const ROLE_BADGES: Record<string, 'error' | 'warning' | 'default'> = {
  ADMIN: 'error',
  POWER_USER: 'warning',
  VIEWER: 'default',
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setUsers(data.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const updateUser = async (userId: string, data: Record<string, unknown>) => {
    setUpdatingId(userId)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...data }),
      })
      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error || 'Failed to update user')
      }
      await fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setUpdatingId(null)
    }
  }

  const isLockedOut = (user: UserRecord) => {
    if (!user.chatPinLockedUntil) return false
    return new Date(user.chatPinLockedUntil) > new Date()
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
        <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage user roles, permissions, and chat PIN security. Users are auto-provisioned on first HubSpot login.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Chat PIN</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{u.name}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    disabled={updatingId === u.id}
                    onChange={(e) => updateUser(u.id, { role: e.target.value })}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
                  >
                    <option value="VIEWER">Viewer</option>
                    <option value="POWER_USER">Power User</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      {u.chatPinRequired ? (
                        <Badge variant="warning">Required</Badge>
                      ) : (
                        <Badge variant="default">Optional</Badge>
                      )}
                      {u.hasChatPin ? (
                        <Badge variant="success">PIN Set</Badge>
                      ) : (
                        <span className="text-xs text-gray-400">No PIN</span>
                      )}
                      {isLockedOut(u) && (
                        <Badge variant="error">Locked Out</Badge>
                      )}
                    </div>
                    {u.chatPinFailures > 0 && !isLockedOut(u) && (
                      <span className="text-xs text-amber-600">
                        {u.chatPinFailures} failed attempt(s)
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1 flex-wrap">
                    <button
                      onClick={() => updateUser(u.id, { chatPinRequired: !u.chatPinRequired })}
                      disabled={updatingId === u.id}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                        u.chatPinRequired
                          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                      title={u.chatPinRequired ? 'Make PIN optional' : 'Require PIN'}
                    >
                      {u.chatPinRequired ? 'Make Optional' : 'Require PIN'}
                    </button>
                    {u.hasChatPin && (
                      <button
                        onClick={() => {
                          if (confirm(`Reset PIN for ${u.name}? They will need to set a new PIN.`)) {
                            updateUser(u.id, { resetPin: true })
                          }
                        }}
                        disabled={updatingId === u.id}
                        className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors disabled:opacity-50"
                      >
                        Reset PIN
                      </button>
                    )}
                    {isLockedOut(u) && (
                      <button
                        onClick={() => updateUser(u.id, { unlockPin: true })}
                        disabled={updatingId === u.id}
                        className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                      >
                        Unlock
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <p className="text-center text-gray-500 py-8">
          No users found. Users will appear here after their first HubSpot login.
        </p>
      )}
    </div>
  )
}
