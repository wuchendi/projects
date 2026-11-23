'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@cdlab/ui/components/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@cdlab/ui/components/sidebar'
import { GitHubIcon } from '@cdlab/ui/icon'
import { BookOpen, ChevronsUpDown, LogOut, Palette } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { authClient } from '@/lib/auth-client'

const REPO_HREF = 'https://github.com/WuChenDi/projects/tree/main/apps/wepush'
const DOCS_HREF =
  'https://github.com/WuChenDi/projects/blob/main/apps/wepush/README.md'

export function NavFooter() {
  const { isMobile } = useSidebar()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const user = session?.user

  async function onSignOut() {
    await authClient.signOut()
    router.replace('/')
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            <Image
              src={user?.image || 'https://wcd.pages.dev/logo.png'}
              alt="wepush"
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-lg"
              unoptimized
            />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">
                {user?.name || user?.email || 'wepush'}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {user?.email || '推送控制台'}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'top'}
            align="end"
            sideOffset={4}
          >
            {user ? (
              <>
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Palette className="size-4" />
                主题
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                  <DropdownMenuRadioItem value="light">
                    浅色
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    深色
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    跟随系统
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              render={
                <Link
                  href={DOCS_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <BookOpen className="size-4" />
              文档
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <Link
                  href={REPO_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <GitHubIcon className="size-4" />
              源码仓库
            </DropdownMenuItem>

            {user ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void onSignOut()}>
                  <LogOut className="size-4" />
                  退出登录
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
