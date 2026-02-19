'use client'

import { useState, useEffect, useCallback } from 'react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

interface GovernanceRule {
  id: string
  name: string
  description?: string
  toolName: string
  action: 'ALLOW' | 'REQUIRE_CONFIRM' | 'BLOCK'
  appliesTo: string[]
  isActive: boolean
  createdAt: string
}

const ACTION_BADGES: Record<string, { label: string; variant: 'success' | 'warning' | 'error' }> = {
  ALLOW: { label: 'Allow', variant: 'success' },
  REQUIRE_CONFIRM: { label: 'Require Confirm', variant: 'warning' },
  BLOCK: { label: 'Block', variant: 'error' },
}

export default function GovernanceRuleEditor() {
  const [rules, setRules] = useState<GovernanceRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingRule, setEditingRule] = useState<Partial<GovernanceRule> | null>(null)

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/governance')
      if (!res.ok) throw new Error('Failed to fetch rules')
      const data = await res.json()
      setRules(data.rules)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const saveRule = async () => {
    if (!editingRule) return

    try {
      const method = editingRule.id ? 'PUT' : 'POST'
      const res = await fetch('/api/admin/governance', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRule),
      })
      if (!res.ok) throw new Error('Failed to save rule')
      setEditingRule(null)
      await fetchRules()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const deleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return

    try {
      const res = await fetch(`/api/admin/governance?id=${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete rule')
      await fetchRules()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const toggleActive = async (rule: GovernanceRule) => {
    try {
      const res = await fetch('/api/admin/governance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rule, isActive: !rule.isActive }),
      })
      if (!res.ok) throw new Error('Failed to update rule')
      await fetchRules()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  // Group rules by toolName
  const groupedRules = rules.reduce<Record<string, GovernanceRule[]>>((acc, rule) => {
    if (!acc[rule.toolName]) acc[rule.toolName] = []
    acc[rule.toolName].push(rule)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Governance Rules</h2>
          <p className="text-sm text-gray-500 mt-1">
            Control which MCP tools users can execute and under what conditions.
          </p>
        </div>
        <Button
          onClick={() =>
            setEditingRule({
              name: '',
              toolName: '',
              action: 'REQUIRE_CONFIRM',
              appliesTo: ['POWER_USER'],
              isActive: true,
            })
          }
        >
          Add Rule
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Rule editor modal */}
      {editingRule && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="font-medium text-gray-900 mb-3">
            {editingRule.id ? 'Edit Rule' : 'New Rule'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={editingRule.name || ''}
                onChange={(e) =>
                  setEditingRule({ ...editingRule, name: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g. Allow contact search"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tool Name
              </label>
              <input
                type="text"
                value={editingRule.toolName || ''}
                onChange={(e) =>
                  setEditingRule({ ...editingRule, toolName: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g. hubspot_search_crm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action
              </label>
              <select
                value={editingRule.action || 'REQUIRE_CONFIRM'}
                onChange={(e) =>
                  setEditingRule({
                    ...editingRule,
                    action: e.target.value as GovernanceRule['action'],
                  })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="ALLOW">Allow</option>
                <option value="REQUIRE_CONFIRM">Require Confirmation</option>
                <option value="BLOCK">Block</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Applies To
              </label>
              <div className="flex gap-3 mt-1">
                {['ADMIN', 'POWER_USER', 'VIEWER'].map((role) => (
                  <label key={role} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={editingRule.appliesTo?.includes(role) || false}
                      onChange={(e) => {
                        const current = editingRule.appliesTo || []
                        setEditingRule({
                          ...editingRule,
                          appliesTo: e.target.checked
                            ? [...current, role]
                            : current.filter((r) => r !== role),
                        })
                      }}
                    />
                    {role}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={editingRule.description || ''}
              onChange={(e) =>
                setEditingRule({ ...editingRule, description: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Optional description"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={saveRule} size="sm">
              Save
            </Button>
            <Button
              variant="secondary"
              onClick={() => setEditingRule(null)}
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Rules list grouped by tool */}
      {Object.entries(groupedRules).map(([toolName, toolRules]) => (
        <div key={toolName} className="mb-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2 font-mono">
            {toolName}
          </h3>
          <div className="space-y-2">
            {toolRules.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                  rule.isActive
                    ? 'border-gray-200 bg-white'
                    : 'border-gray-100 bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Badge variant={ACTION_BADGES[rule.action]?.variant || 'default'}>
                    {ACTION_BADGES[rule.action]?.label || rule.action}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {rule.name}
                    </p>
                    {rule.description && (
                      <p className="text-xs text-gray-500">{rule.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {rule.appliesTo.map((role) => (
                      <Badge key={role} variant="info">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(rule)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      rule.isActive ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        rule.isActive ? 'translate-x-4' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingRule(rule)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteRule(rule.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {rules.length === 0 && (
        <p className="text-center text-gray-500 py-8">
          No governance rules configured. Add your first rule above.
        </p>
      )}
    </div>
  )
}
