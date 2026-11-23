'use client'

import { shellLabelsZh } from '@cdlab/ui/shell/core/labels'
import type { ShellPrefs } from '@cdlab/ui/shell/core/prefs'
import type { ShellSpace } from '@cdlab/ui/shell/core/spaces'
import { AppShell } from '@cdlab/ui/shell/layout/app-shell'
import type { ShellSearchResult } from '@cdlab/ui/shell/search/search-dialog'
import { SearchDialog } from '@cdlab/ui/shell/search/search-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { Bug, FileText, Home, ListChecks, Settings, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { WepushLogo } from '@/components/layout/logo'
import { NavFooter } from '@/components/layout/nav-footer'
import { SPACE_PANELS } from '@/components/layout/space-panels'
import { fetchTemplates, fetchUsers } from '@/lib/queries'

// Rail entries: the core console features, then the tooling / configuration
// entries pinned to the rail foot.
const SPACES: ShellSpace[] = [
  {
    key: 'overview',
    href: '/dashboard',
    label: '概览',
    icon: Home,
    exact: true,
  },
  { key: 'users', href: '/dashboard/users', label: '接收人', icon: Users },
  {
    key: 'templates',
    href: '/dashboard/templates',
    label: '模板',
    icon: FileText,
  },
  { key: 'logs', href: '/dashboard/logs', label: '日志', icon: ListChecks },
  {
    key: 'debug',
    href: '/dashboard/debug',
    label: '探测',
    icon: Bug,
    footer: true,
  },
  {
    key: 'settings',
    href: '/dashboard/settings',
    label: '设置',
    icon: Settings,
    footer: true,
  },
]

// The console chrome: the shared `@cdlab/ui/shell` (appshell registry, `packages/ui/src/shell`) fed with
// wepush's spaces, their panels and the account menu.
export function DashboardShell({
  prefs,
  children,
}: {
  /** The shell prefs cookie as read on the server, so SSR matches the client. */
  prefs: ShellPrefs
  children: React.ReactNode
}) {
  const router = useRouter()
  const qc = useQueryClient()
  const [searchOpen, setSearchOpen] = useState(false)

  // Cmd/Ctrl+K: recipients and templates from the same cached lists the pages
  // and panels use, matched client-side.
  const search = useCallback(
    async (query: string): Promise<ShellSearchResult[]> => {
      const q = query.toLowerCase()
      const [users, templates] = await Promise.all([
        qc.fetchQuery({ queryKey: ['users'], queryFn: fetchUsers }),
        qc.fetchQuery({ queryKey: ['templates'], queryFn: fetchTemplates }),
      ])
      const has = (...values: (string | null | undefined)[]) =>
        values.some((v) => v?.toLowerCase().includes(q))
      return [
        ...users
          .filter((u) => has(u.name, u.wechatOpenId, u.city))
          .map((u) => ({
            id: `user:${u.id}`,
            label: u.name || u.wechatOpenId,
            detail: u.templateCode || undefined,
            icon: Users,
            onSelect: () => router.push(`/dashboard/users/${u.id}`),
          })),
        ...templates
          .filter((t) => has(t.code, t.title))
          .map((t) => ({
            id: `template:${t.id}`,
            label: t.title || t.code,
            detail: t.code,
            icon: FileText,
            onSelect: () => router.push(`/dashboard/templates/${t.id}`),
          })),
      ]
    },
    [qc, router],
  )

  return (
    <AppShell
      spaces={SPACES}
      panels={SPACE_PANELS}
      homeHref="/dashboard"
      logo={<WepushLogo className="size-[18px]" />}
      logoLabel="wepush"
      account={<NavFooter />}
      labels={shellLabelsZh}
      prefs={prefs}
      newAction={{
        label: '新建接收人',
        onSelect: () => router.push('/dashboard/users/new'),
      }}
      onSearch={() => setSearchOpen(true)}
    >
      {children}
      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        spaces={SPACES}
        search={search}
        resultsLabel="接收人 / 模板"
      />
    </AppShell>
  )
}
