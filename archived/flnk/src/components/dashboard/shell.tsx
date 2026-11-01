'use client'

import { ScrollArea } from '@cdlab/ui/components/scroll-area'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@cdlab/ui/components/sidebar'
import { IKFooter } from '@cdlab/ui/IK'
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
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { NavUser } from '@/components/dashboard/nav-user'
import { FlnkLogo } from '@/components/layout'

interface NavItem {
  href: string
  key: string
  icon: LucideIcon
  exact: boolean
}

// Core product features.
const MAIN_ITEMS: NavItem[] = [
  { href: '/dashboard', key: 'overview', icon: BarChart3, exact: true },
  { href: '/dashboard/links', key: 'links', icon: Link2, exact: false },
  {
    href: '/dashboard/launchpads',
    key: 'launchpads',
    icon: Rocket,
    exact: false,
  },
  {
    href: '/dashboard/analytics',
    key: 'analytics',
    icon: Sparkles,
    exact: false,
  },
  {
    href: '/dashboard/realtime',
    key: 'realtime',
    icon: Activity,
    exact: false,
  },
  { href: '/dashboard/check', key: 'check', icon: ShieldCheck, exact: false },
]

// Management / admin utilities, pinned to the bottom of the sidebar.
const MANAGE_ITEMS: NavItem[] = [
  { href: '/dashboard/migrate', key: 'migrate', icon: Database, exact: false },
  {
    href: '/dashboard/settings',
    key: 'settings',
    icon: Settings,
    exact: false,
  },
]

function isActive(pathname: string, item: NavItem) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const t = useTranslations('dashboard.nav')
  const tc = useTranslations('common')

  const renderItem = (item: NavItem) => {
    const Icon = item.icon
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          asChild
          isActive={isActive(pathname, item)}
          tooltip={t(item.key)}
        >
          <Link href={item.href}>
            <Icon />
            <span>{t(item.key)}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                size="lg"
                asChild
                className="flex-1 group-data-[collapsible=icon]:hidden"
              >
                <Link href="/dashboard">
                  <FlnkLogo className="size-6" />
                  <span className="truncate font-semibold">
                    {tc('appName')}
                  </span>
                </Link>
              </SidebarMenuButton>
              <SidebarTrigger />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t('group.workspace')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{MAIN_ITEMS.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>{t('group.manage')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{MANAGE_ITEMS.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <NavUser />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b bg-background/80 px-4 backdrop-blur md:hidden">
          <SidebarTrigger className="-ml-1" />
        </header>

        {/* One scroll region for the whole page. The footer lives inside it so
            it flows at the end of the content instead of being pinned to the
            viewport — matching the (non-persistent) header. The viewport's inner
            wrapper is forced into a full-height flex column so `main` (flex-1)
            keeps the footer at the bottom on short pages and lets it scroll away
            on tall ones. */}
        <ScrollArea className="h-[calc(100svh-3.5rem)] md:h-svh [&>[data-slot=scroll-area-viewport]>div]:!flex [&>[data-slot=scroll-area-viewport]>div]:min-h-full [&>[data-slot=scroll-area-viewport]>div]:flex-col">
          <main className="flex flex-1 flex-col p-4 pt-4 md:px-6 md:pt-6">
            {children}
          </main>
          <IKFooter year={new Date().getFullYear()} />
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  )
}
