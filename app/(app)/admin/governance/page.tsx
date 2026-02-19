import { getSessionFromCookie } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import GovernanceRuleEditor from '@/components/admin/GovernanceRuleEditor'

export default async function GovernancePage() {
  const session = await getSessionFromCookie()
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/chat')
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <GovernanceRuleEditor />
    </div>
  )
}
