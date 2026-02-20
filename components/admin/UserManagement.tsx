'use client'

import { useState, useEffect, useCallback } from 'react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'

interface PortalInfo {
  id: string
  name: string
  hubspotPortalId: string
}

interface UserRecord {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'POWER_USER' | 'VIEWER'
  portalId: string | null
  portalName: string | null
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
  const [portals, setPortals] = useState<PortalInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({ email: '', name: '', role: 'VIEWER' as string })

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, portalsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/portals'),
      ])
      if (!usersRes.ok) throw new Error('Failed to fetch users')
      const usersData = await usersRes.json()
      setUsers(usersData.users)
      if (portalsRes.ok) {
        const portalsData = await portalsRes.json()
        setPortals(portalsData.portals)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setUpdatingId(null)
    }
  }

  const createUser = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error || 'Failed to create user')
      }
      setShowCreateModal(false)
      setCreateForm({ email: '', name: '', role: 'VIEWER' })
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setCreating(false)
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
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage user roles, portal assignments, and chat PIN security.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateModal(true)}>
          + Create User
        </Button>
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setError(null) }}
        title="Create New User"
      >
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="user@example.com"
            value={createForm.email}
            onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            label="Name"
            placeholder="Full name"
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="VIEWER">Viewer</option>
              <option value="POWER_USER">Power User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowCreateModal(false); setError(null) }}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={creating || !createForm.email || !createForm.name}
              onClick={createUser}
            >
              {creating ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </div>
      </Modal>

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
              <th className="text-left px-4 py-3 font-medium text-gray-600">Portal</th>
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
                  <select
                    value={u.portalId || ''}
                    disabled={updatingId === u.id}
                    onChange={(e) => updateUser(u.id, { portalId: e.target.value || null })}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
                  >
                    <option value="">No portal</option>
                    {portals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
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
          No users found. Users will appear here after they register.
        </p>
      )}
    </div>
  )
}
