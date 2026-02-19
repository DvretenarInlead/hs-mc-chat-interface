'use client'

import { useState, useEffect, useCallback } from 'react'
import Badge from '@/components/ui/Badge'

interface SensitiveField {
  id: string
  objectType: string
  fieldName: string
  label: string
  maskStyle: 'FULL' | 'PARTIAL' | 'REDACT'
  minRole: 'ADMIN' | 'POWER_USER' | 'VIEWER'
  isActive: boolean
}

const OBJECT_TYPES = ['contacts', 'companies', 'deals', 'tickets']
const MASK_STYLES = [
  { value: 'PARTIAL', label: 'Partial (jo**hn)' },
  { value: 'FULL', label: 'Full (******)' },
  { value: 'REDACT', label: 'Redact ([RESTRICTED])' },
]
const ROLES = [
  { value: 'ADMIN', label: 'Admin only' },
  { value: 'POWER_USER', label: 'Power User+' },
  { value: 'VIEWER', label: 'All roles' },
]

export default function SensitiveFieldManager() {
  const [fields, setFields] = useState<SensitiveField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const [newObjectType, setNewObjectType] = useState('contacts')
  const [newFieldName, setNewFieldName] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newMaskStyle, setNewMaskStyle] = useState('PARTIAL')
  const [newMinRole, setNewMinRole] = useState('ADMIN')

  const fetchFields = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/fields')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setFields(data.fields)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFields()
  }, [fetchFields])

  const addField = async () => {
    if (!newFieldName.trim() || !newLabel.trim()) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectType: newObjectType,
          fieldName: newFieldName.trim(),
          label: newLabel.trim(),
          maskStyle: newMaskStyle,
          minRole: newMinRole,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add')
      }
      setNewFieldName('')
      setNewLabel('')
      await fetchFields()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setAdding(false)
    }
  }

  const toggleField = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/admin/fields', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      })
      if (!res.ok) throw new Error('Failed to update')
      await fetchFields()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const deleteField = async (id: string) => {
    if (!confirm('Remove this sensitive field rule?')) return
    try {
      const res = await fetch('/api/admin/fields', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Failed to delete')
      await fetchFields()
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
        <h2 className="text-lg font-semibold text-gray-900">Sensitive Field Rules</h2>
        <p className="text-sm text-gray-500 mt-1">
          Mark specific HubSpot CRM fields as sensitive. These fields will be masked in chat responses based on user role.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Add new field */}
      <div className="mb-6 rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Add Sensitive Field</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <select
            value={newObjectType}
            onChange={(e) => setNewObjectType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
          >
            {OBJECT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="text"
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            placeholder="Field name (e.g. mobilephone)"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Display label (e.g. Mobile Phone)"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
          />
          <select
            value={newMaskStyle}
            onChange={(e) => setNewMaskStyle(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
          >
            {MASK_STYLES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={newMinRole}
            onChange={(e) => setNewMinRole(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button
            onClick={addField}
            disabled={adding || !newFieldName.trim() || !newLabel.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {adding ? 'Adding...' : 'Add Field'}
          </button>
        </div>
      </div>

      {/* Fields list */}
      {fields.length === 0 ? (
        <p className="text-center text-gray-500 py-8">
          No sensitive field rules configured. Add rules above to mask specific CRM fields in chat.
        </p>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Object</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Field</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Mask</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Visible To</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fields.map((field) => (
                <tr key={field.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 capitalize">{field.objectType}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{field.label}</div>
                    <div className="text-xs text-gray-400 font-mono">{field.fieldName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={field.maskStyle === 'REDACT' ? 'error' : field.maskStyle === 'FULL' ? 'warning' : 'info'}>
                      {field.maskStyle}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">{field.minRole === 'ADMIN' ? 'Admin' : field.minRole === 'POWER_USER' ? 'Power User+' : 'All'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={field.isActive ? 'success' : 'default'}>
                      {field.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleField(field.id, !field.isActive)}
                        className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        {field.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => deleteField(field.id)}
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
