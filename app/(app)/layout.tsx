import { getSessionFromCookie } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import AppShell from './AppShell'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionFromCookie()

  if (!session) {
    redirect('/login')
  }

  return (
    <AppShell user={{ name: session.user.name, email: session.user.email, role: session.user.role }}>
      {children}
    </AppShell>
  )
}
