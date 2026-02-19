'use client'

import { useState, useEffect, useCallback } from 'react'
import Badge from '@/components/ui/Badge'

interface SensitivityRule {
  id: string
  name: string
  description: string | null
  pattern: string
  category: string
  maskStyle: string
  isActive: boolean
  isBuiltIn: boolean
  createdAt: string
}

const CATEGORIES = ['EMAIL', 'PHONE', 'SSN', 'CREDIT_CARD', 'API_KEY', 'CUSTOM']
const MASK_STYLES = ['FULL', 'PARTIAL', 'REDACT']

const MASK_STYLE_LABELS: Record<string, string> = {
  FULL: 'Full (********)',
  PARTIAL: 'Partial (jo***@***.com)',
  REDACT: 'Redact ([REDACTED])',
}

const CATEGORY_COLORS: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  EMAIL: 'default',
  PHONE: 'default',
  SSN: 'error',
  CREDIT_CARD: 'error',
  API_KEY: 'warning',
  CUSTOM: 'success',
}

export default function SensitivityRuleEditor() {
  const [rules, setRules] = useState<SensitivityRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  // New rule form
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPattern, setNewPattern] = useState('')
  const [newCategory, setNewCategory] = useState('CUSTOM')
  const [newMaskStyle, setNewMaskStyle] = useState('FULL')
  const [saving, setSaving] = useState(false)

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sensitivity')
      if (res.ok) {
        const data = await res.json()
        setRules(data.rules)
      } else {
        setError('Failed to load sensitivity rules')
      }
    } catch {
      setError('Failed to load sensitivity rules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const handleToggle = useCallback(async (rule: SensitivityRule) => {
    try {
      const res = await fetch('/api/admin/sensitivity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
      })
      if (res.ok) {
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r))
        )
      }
    } catch {
      setError('Failed to update rule')
    }
  }, [])

  const handleDelete = useCallback(async (ruleId: string) => {
    if (!confirm('Delete this sensitivity rule?')) return

    try {
      const res = await fetch(`/api/admin/sensitivity?id=${ruleId}`, { method: 'DELETE' })
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== ruleId))
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete rule')
      }
    } catch {
      setError('Failed to delete rule')
    }
  }, [])

  const handleAdd = useCallback(async () => {
    if (!newName.trim() || !newPattern.trim()) return

    // Validate regex client-side
    try {
      new RegExp(newPattern)
    } catch {
      setError('Invalid regex pattern')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/sensitivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          pattern: newPattern,
          category: newCategory,
          maskStyle: newMaskStyle,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setRules((prev) => [...prev, data.rule])
        setNewName('')
        setNewDescription('')
        setNewPattern('')
        setNewCategory('CUSTOM')
        setNewMaskStyle('FULL')
        setShowAdd(false)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to create rule')
      }
    } catch {
      setError('Failed to create rule')
    } finally {
      setSaving(false)
    }
  }, [newName, newDescription, newPattern, newCategory, newMaskStyle])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Rules list */}
      <div className="space-y-3">
        {rules.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            No sensitivity rules configured. Add rules to automatically mask sensitive data in chat responses.
          </p>
        )}

        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`border rounded-xl p-4 transition-colors ${
              rule.isActive ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-sm text-gray-900">{rule.name}</h3>
                  <Badge variant={CATEGORY_COLORS[rule.category] || 'default'}>
                    {rule.category}
                  </Badge>
                  <Badge variant="default">
                    {MASK_STYLE_LABELS[rule.maskStyle] || rule.maskStyle}
                  </Badge>
                  {rule.isBuiltIn && (
                    <Badge variant="warning">Built-in</Badge>
                  )}
                </div>
                {rule.description && (
                  <p className="text-xs text-gray-500 mb-1">{rule.description}</p>
                )}
                <code className="text-xs text-gray-400 font-mono break-all">
                  {rule.pattern}
                </code>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleToggle(rule)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    rule.isActive ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      rule.isActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                {!rule.isBuiltIn && (
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete rule"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add new rule */}
      {showAdd ? (
        <div className="border border-blue-200 rounded-xl p-4 bg-blue-50 space-y-3">
          <h3 className="text-sm font-medium text-gray-900">Add Custom Rule</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Rule name"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
            />
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <input
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            placeholder="Regex pattern (e.g. \bACCT-\d{6}\b)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:border-blue-500 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={newMaskStyle}
              onChange={(e) => setNewMaskStyle(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
            >
              {MASK_STYLES.map((s) => (
                <option key={s} value={s}>{MASK_STYLE_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !newName.trim() || !newPattern.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Add Rule'}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          + Add Custom Sensitivity Rule
        </button>
      )}
    </div>
  )
}
