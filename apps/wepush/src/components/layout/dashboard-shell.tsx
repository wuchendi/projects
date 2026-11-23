'use client'

import { shellLabelsZh } from '@cdlab/ui/shell/core/labels'
import type { ShellPrefs } from '@cdlab/ui/shell/core/prefs'
import type { ShellSpace } from '@cdlab/ui/shell/core/spaces'
import { AppShell } from '@cdlab/ui/shell/layout/app-shell'
import { Bug, FileText, Home, ListChecks, Settings, Users } from 'lucide-react'
import { WepushLogo } from '@/components/layout/logo'
import { NavFooter } from '@/components/layout/nav-footer'

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
// wepush's spaces and account menu.
export function DashboardShell({
  prefs,
  children,
}: {
  /** The shell prefs cookie as read on the server, so SSR matches the client. */
  prefs: ShellPrefs
  children: React.ReactNode
}) {
  return (
    <AppShell
      spaces={SPACES}
      homeHref="/dashboard"
      logo={<WepushLogo className="size-[18px]" />}
      logoLabel="wepush"
      account={<NavFooter />}
      labels={shellLabelsZh}
      prefs={prefs}
    >
      {children}
    </AppShell>
  )
}
