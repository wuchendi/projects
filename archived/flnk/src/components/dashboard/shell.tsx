'use client'

import type { ShellLabels } from '@cdlab/ui/shell/core/labels'
import type { ShellPrefs } from '@cdlab/ui/shell/core/prefs'
import type { ShellSpace } from '@cdlab/ui/shell/core/spaces'
import { AppShell } from '@cdlab/ui/shell/layout/app-shell'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BarChart3,
  Database,
  Link2,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { NavUser } from '@/components/dashboard/nav-user'
import { FlnkLogo } from '@/components/layout'

interface NavItem {
  href: string
  key: string
  icon: LucideIcon
  exact?: boolean
  /** Management utilities sit at the rail foot as icons. */
  footer?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', key: 'overview', icon: BarChart3, exact: true },
  { href: '/dashboard/links', key: 'links', icon: Link2 },
  { href: '/dashboard/launchpads', key: 'launchpads', icon: Rocket },
  { href: '/dashboard/analytics', key: 'analytics', icon: Sparkles },
  { href: '/dashboard/realtime', key: 'realtime', icon: Activity },
  { href: '/dashboard/check', key: 'check', icon: ShieldCheck },
  { href: '/dashboard/migrate', key: 'migrate', icon: Database, footer: true },
  { href: '/dashboard/settings', key: 'settings', icon: Settings, footer: true },
]

// Shell placeholders (`{count}` …) are filled in by the shell, so they are
// passed through next-intl unchanged.
const KEEP = {
  count: '{count}',
  total: '{total}',
  page: '{page}',
  pages: '{pages}',
  size: '{size}',
  name: '{name}',
}

function useShellLabels(): ShellLabels {
  const t = useTranslations('dashboard.shell')
  return useMemo(
    () => ({
      toggleSidebar: t('toggleSidebar'),
      openMenu: t('openMenu'),
      search: t('search'),
      searchPlaceholder: t('searchPlaceholder'),
      searchEmpty: t('searchEmpty'),
      searchFailed: t('searchFailed'),
      goTo: t('goTo'),
      filter: t('filter'),
      filterActive: t('filterActive', KEEP),
      display: t('display'),
      reset: t('reset'),
      clearSearch: t('clearSearch'),
      loading: t('loading'),
      selectedCount: t('selectedCount', KEEP),
      selectAll: t('selectAll'),
      deselectAll: t('deselectAll'),
      selectRow: t('selectRow', KEEP),
      clearSelection: t('clearSelection'),
      columns: t('columns'),
      pagerTotal: t('pagerTotal', KEEP),
      pagerSelected: t('pagerSelected', KEEP),
      pagerPage: t('pagerPage', KEEP),
      pageSize: t('pageSize', KEEP),
      firstPage: t('firstPage'),
      previousPage: t('previousPage'),
      nextPage: t('nextPage'),
      lastPage: t('lastPage'),
    }),
    [t],
  )
}

// The dashboard chrome: the shared `@cdlab/ui/shell` (appshell registry) fed
// with flnk's spaces and account menu.
export function DashboardShell({
  prefs,
  children,
}: {
  /** The shell prefs cookie as read on the server, so SSR matches the client. */
  prefs: ShellPrefs
  children: React.ReactNode
}) {
  const t = useTranslations('dashboard.nav')
  const tc = useTranslations('common')
  const labels = useShellLabels()

  const spaces: ShellSpace[] = useMemo(
    () =>
      NAV_ITEMS.map((item) => ({
        key: item.key,
        href: item.href,
        label: t(item.key),
        icon: item.icon,
        ...(item.exact ? { exact: true } : {}),
        ...(item.footer ? { footer: true } : {}),
      })),
    [t],
  )

  return (
    <AppShell
      spaces={spaces}
      homeHref="/dashboard"
      logo={<FlnkLogo className="size-[18px]" />}
      logoLabel={tc('appName')}
      account={<NavUser />}
      labels={labels}
      prefs={prefs}
    >
      {children}
    </AppShell>
  )
}
