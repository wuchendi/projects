'use client'

import { shellLabelsEn, shellLabelsZh } from '@cdlab/ui/shell/core/labels'
import type { ShellPrefs } from '@cdlab/ui/shell/core/prefs'
import type { ShellSpace } from '@cdlab/ui/shell/core/spaces'
import { AppShell } from '@cdlab/ui/shell/layout/app-shell'
import type { ShellSearchResult } from '@cdlab/ui/shell/search/search-dialog'
import { SearchDialog } from '@cdlab/ui/shell/search/search-dialog'
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
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useMemo, useState } from 'react'
import { NavUser } from '@/components/dashboard/nav-user'
import { SPACE_PANELS } from '@/components/dashboard/space-panels'
import { FlnkLogo } from '@/components/layout'
import { buildShortUrl } from '@/lib/format/format'
import { linkApi } from '@/lib/platform/api'

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

// The dashboard chrome: the shared `@cdlab/ui/shell` (appshell registry) fed
// with flnk's spaces, their panels and the account menu.
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
  // The shell ships its strings in English and Chinese; flnk's locales match.
  const labels = useLocale() === 'zh' ? shellLabelsZh : shellLabelsEn

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

  const router = useRouter()
  const tl = useTranslations('links')
  const [searchOpen, setSearchOpen] = useState(false)

  // Cmd/Ctrl+K: server-side link search; a hit opens that link's analytics.
  const search = useCallback(
    async (query: string): Promise<ShellSearchResult[]> => {
      const { links } = await linkApi.search(query)
      return links.map((link) => ({
        id: link.id,
        label: link.title?.trim() || link.slug,
        detail: buildShortUrl(link.slug, link.domain).replace(/^https?:\/\//, ''),
        icon: Link2,
        onSelect: () =>
          router.push(
            `/dashboard/analytics?slug=${encodeURIComponent(link.slug)}`,
          ),
      }))
    },
    [router],
  )

  return (
    <AppShell
      spaces={spaces}
      panels={SPACE_PANELS}
      homeHref="/dashboard"
      logo={<FlnkLogo className="size-[18px]" />}
      logoLabel={tc('appName')}
      account={<NavUser />}
      labels={labels}
      prefs={prefs}
      newAction={{
        label: tl('new'),
        onSelect: () => router.push('/dashboard/links?new=1'),
      }}
      onSearch={() => setSearchOpen(true)}
    >
      {children}
      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        spaces={spaces}
        search={search}
        resultsLabel={t('links')}
      />
    </AppShell>
  )
}
