import { getSessionFromCookie } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import AuditLogTable from '@/components/admin/AuditLogTable'

export default async function LogsPage() {
  const session = await getSessionFromCookie()
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/chat')
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <AuditLogTable />
    </div>
  )
}
