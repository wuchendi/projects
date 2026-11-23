'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@cdlab/ui/components/dropdown-menu'
import type { ReactNode } from 'react'

/**
 * The account control at the foot of the shared app shell's rail: an avatar
 * button that opens a menu to its right. Pass it as `AppShell`'s `account`.
 * The menu items (theme, links, sign out…) are the app's own `children`.
 */
export function IKRailAccountMenu({
  label,
  avatar,
  children,
}: {
  /** Accessible name of the avatar button, e.g. the user's name or email. */
  label: string
  /** The avatar image or initials, about 28px. */
  avatar: ReactNode
  children: ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="grid size-9 place-items-center rounded-md outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-foreground/[0.07]"
      >
        {avatar}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56 rounded-lg"
        side="right"
        align="end"
        sideOffset={8}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
