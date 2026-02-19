'use client'

import { useState, useEffect, useCallback } from 'react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

interface AuditLog {
  id: string
  userId: string
  userEmail: string
  action: string
  toolName: string
  inputSummary: string
  outputSummary?: string
  recordType?: string
  recordId?: string
  status: string
  createdAt: string
  user: { name: string; email: string }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const STATUS_BADGES: Record<string, { variant: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
  COMPLETED: { variant: 'success' },
  APPROVED: { variant: 'success' },
  PENDING: { variant: 'warning' },
  REJECTED: { variant: 'error' },
  BLOCKED: { variant: 'error' },
}

export default function AuditLogTable() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    toolName: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  })

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      })
      if (filters.toolName) params.set('toolName', filters.toolName)
      if (filters.status) params.set('status', filters.status)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)

      const res = await fetch(`/api/admin/logs?${params}`)
      if (!res.ok) throw new Error('Failed to fetch logs')
      const data = await res.json()
      setLogs(data.logs)
      setPagination(data.pagination)
    } catch (err) {
      console.error('Failed to fetch audit logs:', err)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filters])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const exportCsv = () => {
    const headers = [
      'Timestamp',
      'User',
      'Action',
      'Tool',
      'Record Type',
      'Record ID',
      'Status',
      'Input Summary',
    ]
    const rows = logs.map((log) => [
      new Date(log.createdAt).toISOString(),
      log.user.email,
      log.action,
      log.toolName,
      log.recordType || '',
      log.recordId || '',
      log.status,
      `"${log.inputSummary.replace(/"/g, '""')}"`,
    ])

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Audit Log</h2>
          <p className="text-sm text-gray-500 mt-1">
            View all MCP tool calls made by users.
          </p>
        </div>
        <Button variant="secondary" onClick={exportCsv} size="sm">
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Filter by tool name"
          value={filters.toolName}
          onChange={(e) =>
            setFilters({ ...filters, toolName: e.target.value })
          }
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />
        <select
          value={filters.status}
          onChange={(e) =>
            setFilters({ ...filters, status: e.target.value })
          }
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="BLOCKED">Blocked</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) =>
            setFilters({ ...filters, dateFrom: e.target.value })
          }
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) =>
            setFilters({ ...filters, dateTo: e.target.value })
          }
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setFilters({ toolName: '', status: '', dateFrom: '', dateTo: '' })
          }
        >
          Clear
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Timestamp
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                User
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Action
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Tool
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Record
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No audit logs found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className={
                    log.status === 'BLOCKED'
                      ? 'bg-red-50'
                      : 'hover:bg-gray-50'
                  }
                >
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {log.user.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {log.user.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{log.action}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {log.toolName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {log.recordType && (
                      <span>
                        {log.recordType}
                        {log.recordId && ` #${log.recordId}`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        STATUS_BADGES[log.status]?.variant || 'default'
                      }
                    >
                      {log.status}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} entries
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() =>
                setPagination({ ...pagination, page: pagination.page - 1 })
              }
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() =>
                setPagination({ ...pagination, page: pagination.page + 1 })
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
