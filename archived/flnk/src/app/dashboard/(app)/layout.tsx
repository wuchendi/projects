import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { DashboardShell } from '@/components/dashboard/shell'
import { getAllowedSession } from '@/lib/platform/auth'

export default async function ProtectedDashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await getAllowedSession(await headers())
  if (!user) redirect('/dashboard/login')

  return <DashboardShell>{children}</DashboardShell>
}
