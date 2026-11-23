'use client'

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
import { IKFooter, IKPageContainer } from '@cdlab/ui/IK'
import type { LucideIcon } from 'lucide-react'
import { Bug, FileText, Home, ListChecks, Settings, Users } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WepushLogo } from '@/components/layout/logo'
import { NavFooter } from '@/components/layout/nav-footer'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
}

// Core console features.
const MAIN_ITEMS: NavItem[] = [
  { href: '/dashboard', label: '概览', icon: Home, exact: true },
  { href: '/dashboard/users', label: '接收人', icon: Users },
  { href: '/dashboard/templates', label: '模板', icon: FileText },
  { href: '/dashboard/logs', label: '日志', icon: ListChecks },
]

// Tooling / configuration, pinned below the main group.
const MANAGE_ITEMS: NavItem[] = [
  { href: '/dashboard/debug', label: '探测', icon: Bug },
  { href: '/dashboard/settings', label: '设置', icon: Settings },
]

function isActive(pathname: string, item: NavItem) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const renderItem = (item: NavItem) => {
    const Icon = item.icon
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          isActive={isActive(pathname, item)}
          tooltip={item.label}
          render={<Link href={item.href} />}
        >
          <Icon />
          <span>{item.label}</span>
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
                className="flex-1 group-data-[collapsible=icon]:hidden"
                render={<Link href="/dashboard" />}
              >
                <WepushLogo className="size-6 shrink-0 text-primary" />
                <span className="truncate font-semibold">wepush</span>
              </SidebarMenuButton>
              <SidebarTrigger />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>工作区</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{MAIN_ITEMS.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>管理</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{MANAGE_ITEMS.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <NavFooter />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b bg-background/80 px-4 backdrop-blur md:hidden">
          <SidebarTrigger className="-ml-1" />
        </header>

        <IKPageContainer className="flex-col pt-4 md:pt-6">
          {children}
        </IKPageContainer>
        <IKFooter year={new Date().getFullYear()} />
      </SidebarInset>
    </SidebarProvider>
  )
}
