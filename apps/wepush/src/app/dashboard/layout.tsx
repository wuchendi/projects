import { readShellPrefs } from '@cdlab/ui/shell/core/prefs'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { DashboardShell } from '@/components/layout'
import { getAuth } from '@/lib/auth'

// The whole console is per-request: it reads the better-auth session and the
// Cloudflare-bound DB, so it must never be statically prerendered (otherwise
// `getCloudflareContext()` throws at build time).
export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const auth = await getAuth()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  const prefs = readShellPrefs((await cookies()).toString())
  return <DashboardShell prefs={prefs}>{children}</DashboardShell>
}
