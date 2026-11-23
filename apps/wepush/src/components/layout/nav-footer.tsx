'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
import { GitHubIcon } from '@cdlab/ui/icon'
import { BookOpen, LogOut, Palette } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { authClient } from '@/lib/auth-client'

const REPO_HREF = 'https://github.com/WuChenDi/projects/tree/main/apps/wepush'
const DOCS_HREF =
  'https://github.com/WuChenDi/projects/blob/main/apps/wepush/README.md'

// The account control at the foot of the shell rail: the avatar opens the
// account, theme, links and sign-out menu.
export function NavFooter() {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const user = session?.user

  async function onSignOut() {
    await authClient.signOut()
    router.replace('/')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={user?.name || user?.email || '账户'}
        className="grid size-9 place-items-center rounded-md outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-foreground/[0.07]"
      >
        <Image
          src={user?.image || 'https://wcd.pages.dev/logo.png'}
          alt=""
          width={28}
          height={28}
          className="size-7 rounded-full"
          unoptimized
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56 rounded-lg"
        side="right"
        align="end"
        sideOffset={8}
      >
        {user ? (
          <>
            {/* Base UI: a menu label is a group label and needs a group. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                {user.email}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
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
              <DropdownMenuRadioItem value="light">浅色</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">深色</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                跟随系统
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          render={
            <Link href={DOCS_HREF} target="_blank" rel="noopener noreferrer" />
          }
        >
          <BookOpen className="size-4" />
          文档
        </DropdownMenuItem>
        <DropdownMenuItem
          render={
            <Link href={REPO_HREF} target="_blank" rel="noopener noreferrer" />
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
  )
}
