import { redirect } from 'next/navigation'
import { getSessionFromCookie } from '@/lib/auth/session'

export default async function AdminPage() {
  const session = await getSessionFromCookie()
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/chat')
  }
  redirect('/admin/governance')
}
