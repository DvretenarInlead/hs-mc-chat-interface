import { getSessionFromCookie } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import UserManagement from '@/components/admin/UserManagement'

export default async function UsersPage() {
  const session = await getSessionFromCookie()
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/chat')
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <UserManagement />
    </div>
  )
}
