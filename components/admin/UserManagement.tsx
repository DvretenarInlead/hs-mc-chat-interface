'use client'

import { useState, useEffect, useCallback } from 'react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

interface UserRecord {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'POWER_USER' | 'VIEWER'
  hubspotPortalId: string
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

  const updateRole = async (userId: string, role: string) => {
    setUpdatingId(userId)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update role')
      }
      await fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setUpdatingId(null)
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
        <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage user roles and permissions. Users are auto-provisioned on first HubSpot login.
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

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Portal</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
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
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                  {u.hubspotPortalId}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={ROLE_BADGES[u.role] || 'default'}>{u.role}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <select
                    value={u.role}
                    disabled={updatingId === u.id}
                    onChange={(e) => updateRole(u.id, e.target.value)}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
                  >
                    <option value="VIEWER">Viewer</option>
                    <option value="POWER_USER">Power User</option>
                    <option value="ADMIN">Admin</option>
                  </select>
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
