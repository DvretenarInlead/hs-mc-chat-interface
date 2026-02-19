'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface PortalUser {
  id: string
  email: string
  name: string
  role: string
}

interface Portal {
  id: string
  hubspotPortalId: string
  name: string
  connectedById: string
  createdAt: string
  userCount: number
  users: PortalUser[]
}

interface AvailableUser {
  id: string
  email: string
  name: string
  role: string
  portalId: string | null
}

function PortalsContent() {
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const error = searchParams.get('error')

  const [portals, setPortals] = useState<Portal[]>([])
  const [allUsers, setAllUsers] = useState<AvailableUser[]>([])
  const [loading, setLoading] = useState(true)
  const [assigningPortal, setAssigningPortal] = useState<string | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)

  const errorMessages: Record<string, string> = {
    oauth_error: 'HubSpot denied the authorization request.',
    no_code: 'No authorization code received from HubSpot.',
    invalid_state: 'Session expired or invalid request.',
    forbidden: 'Only admins can connect portals.',
    token_exchange_failed: 'Failed to connect — check HubSpot app configuration.',
    user_info_failed: 'Connected but failed to retrieve portal info.',
    encryption_failed: 'Server error: TOKEN_ENCRYPTION_KEY may be misconfigured.',
    db_upsert_failed: 'Database error saving portal.',
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [portalsRes, usersRes] = await Promise.all([
        fetch('/api/admin/portals'),
        fetch('/api/admin/users'),
      ])
      if (portalsRes.ok) {
        const data = await portalsRes.json()
        setPortals(data.portals)
      }
      if (usersRes.ok) {
        const data = await usersRes.json()
        setAllUsers(data.users)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAssign = async (portalId: string) => {
    if (selectedUsers.length === 0) return
    const res = await fetch('/api/admin/portals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portalId, userIds: selectedUsers }),
    })
    if (res.ok) {
      setAssigningPortal(null)
      setSelectedUsers([])
      fetchData()
    }
  }

  const handleDelete = async (portalId: string) => {
    if (!confirm('Disconnect this portal? All assigned users will lose access.')) return
    setDeleting(portalId)
    try {
      await fetch('/api/admin/portals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portalId }),
      })
      fetchData()
    } finally {
      setDeleting(null)
    }
  }

  const handleRemoveUser = async (userId: string) => {
    await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, portalId: null }),
    })
    fetchData()
  }

  const unassignedUsers = allUsers.filter((u) => !u.portalId)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">HubSpot Portals</h1>
          <p className="text-sm text-gray-500 mt-1">Connect HubSpot portals and assign users</p>
        </div>
        <a
          href="/api/auth/hubspot"
          className="rounded-lg bg-[#ff7a59] text-white px-4 py-2 text-sm font-medium hover:bg-[#ff5c35] transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984v-.066A2.2 2.2 0 0017.23.833h-.066a2.2 2.2 0 00-2.2 2.2v.067c0 .87.513 1.617 1.25 1.971v2.86a5.884 5.884 0 00-2.627 1.476l-6.95-5.41a2.635 2.635 0 00.076-.612A2.62 2.62 0 004.093.762a2.62 2.62 0 00-2.62 2.622 2.62 2.62 0 002.62 2.622c.47 0 .91-.13 1.29-.349l6.833 5.323a5.9 5.9 0 00-.483 2.343c0 .866.192 1.686.528 2.428l-2.065 2.065a2.07 2.07 0 00-.602-.094 2.084 2.084 0 100 4.168 2.084 2.084 0 002.084-2.084c0-.213-.04-.417-.094-.613l2.012-2.012a5.882 5.882 0 003.607 1.232 5.9 5.9 0 005.9-5.9 5.9 5.9 0 00-5.042-5.832z" />
          </svg>
          Connect Portal
        </a>
      </div>

      {success === 'connected' && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          HubSpot portal connected successfully.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {errorMessages[error] || 'An error occurred.'}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : portals.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 mb-2">No portals connected yet</p>
          <p className="text-sm text-gray-400">Click &quot;Connect Portal&quot; to link a HubSpot account.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {portals.map((portal) => (
            <div key={portal.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{portal.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Portal ID: {portal.hubspotPortalId}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setAssigningPortal(assigningPortal === portal.id ? null : portal.id)
                      setSelectedUsers([])
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {assigningPortal === portal.id ? 'Cancel' : 'Assign Users'}
                  </button>
                  <button
                    onClick={() => handleDelete(portal.id)}
                    disabled={deleting === portal.id}
                    className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                  >
                    {deleting === portal.id ? 'Removing...' : 'Disconnect'}
                  </button>
                </div>
              </div>

              {/* Assigned users */}
              {portal.users.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                    Assigned Users ({portal.users.length})
                  </p>
                  <div className="space-y-1">
                    {portal.users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">
                          {u.name} <span className="text-gray-400">({u.email})</span>
                        </span>
                        <button
                          onClick={() => handleRemoveUser(u.id)}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Assign users panel */}
              {assigningPortal === portal.id && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                    Select users to assign
                  </p>
                  {unassignedUsers.length === 0 ? (
                    <p className="text-sm text-gray-400">All users are already assigned to a portal.</p>
                  ) : (
                    <>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {unassignedUsers.map((u) => (
                          <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(u.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUsers([...selectedUsers, u.id])
                                } else {
                                  setSelectedUsers(selectedUsers.filter((id) => id !== u.id))
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                            <span className="text-gray-700">{u.name}</span>
                            <span className="text-gray-400">({u.email})</span>
                          </label>
                        ))}
                      </div>
                      <button
                        onClick={() => handleAssign(portal.id)}
                        disabled={selectedUsers.length === 0}
                        className="mt-2 rounded-lg bg-blue-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        Assign {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PortalsPage() {
  return (
    <Suspense fallback={
      <div className="p-6 text-center text-gray-500">Loading...</div>
    }>
      <PortalsContent />
    </Suspense>
  )
}
