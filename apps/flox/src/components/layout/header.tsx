'use client'

import { Button } from '@cdlab/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@cdlab/ui/components/dropdown-menu'
import { GitHubIcon } from '@cdlab/ui/icon'
import {
  BookmarkIcon,
  ChevronLeftIcon,
  HeartIcon,
  HistoryIcon,
  MoreHorizontalIcon,
  SettingsIcon,
  TrophyIcon,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Script from 'next/script'
import {
  Fragment,
  Suspense,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { siteConfig } from '@/lib/config/site-config'
import { useHeaderResetStore } from '@/lib/store/header-reset-store'
import { useSidebarStore } from '@/lib/store/sidebar-store'
import { ThemeToggle } from './theme-toggle'

const BUTTON_WIDTH = 44 // icon button width (36px) + gap (8px)

type ActionItem = {
  key: string
  icon: React.ReactNode
  label: string
} & (
  | { type: 'button'; onClick: () => void }
  | { type: 'link'; href: string; external?: boolean }
)

function HeaderInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isPremiumMode =
    pathname.startsWith('/premium') || searchParams.get('premium') === '1'
  const isBack = pathname !== '/' && pathname !== '/premium'

  const homeHref = isPremiumMode ? '/premium' : '/'
  const settingsHref = isPremiumMode ? '/premium/settings' : '/settings'

  const { setFavoritesOpen, setHistoryOpen, setWatchLaterOpen } =
    useSidebarStore()

  const containerRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)

  const [visibleCount, setVisibleCount] = useState(3)

  const allActions: ActionItem[] = [
    ...(isPremiumMode
      ? []
      : [
          {
            key: 'ranking',
            icon: <TrophyIcon className="size-4" />,
            label: '排行榜',
            type: 'link' as const,
            href: '/ranking',
          },
        ]),
    {
      key: 'favorites',
      icon: <HeartIcon className="size-4" />,
      label: '我的收藏',
      type: 'button' as const,
      onClick: () => setFavoritesOpen(true),
    },
    {
      key: 'watchlater',
      icon: <BookmarkIcon className="size-4" />,
      label: '稍后观看',
      type: 'button' as const,
      onClick: () => setWatchLaterOpen(true),
    },
    {
      key: 'history',
      icon: <HistoryIcon className="size-4" />,
      label: '观看历史',
      type: 'button' as const,
      onClick: () => setHistoryOpen(true),
    },
    {
      key: 'settings',
      icon: <SettingsIcon className="size-4" />,
      label: '设置',
      type: 'link' as const,
      href: settingsHref,
    },
    {
      key: 'github',
      icon: <GitHubIcon className="size-4" />,
      label: 'GitHub',
      type: 'link' as const,
      href: 'https://github.com/WuChenDi/projects/tree/main/apps/flox',
      external: true,
    },
  ]

  const measure = useCallback(() => {
    const container = containerRef.current
    const left = leftRef.current
    const right = rightRef.current

    if (!container || !left || !right) return

    const containerWidth = container.offsetWidth
    const leftWidth = left.offsetWidth
    const gap = 8

    // 可用宽度 = 容器宽 - 左侧宽 - 中间gap
    let availableWidth = containerWidth - leftWidth - gap

    // 右侧固定元素：ThemeToggle + 可能的 More 按钮 + 额外安全间距
    const fixedRightWidth = 44 + 44 + 16
    availableWidth -= fixedRightWidth

    if (availableWidth <= 0) {
      setVisibleCount(0)
      return
    }

    const maxPossible = Math.floor(availableWidth / BUTTON_WIDTH)
    setVisibleCount(Math.min(maxPossible, allActions.length))
  }, [allActions.length])

  useLayoutEffect(() => {
    measure()

    const resizeObserver = new ResizeObserver(() => {
      measure()
    })

    if (containerRef.current) resizeObserver.observe(containerRef.current)
    if (leftRef.current) resizeObserver.observe(leftRef.current)

    return () => resizeObserver.disconnect()
  }, [measure])

  const visibleActions = allActions.slice(-visibleCount)
  const overflowActions = allActions.slice(0, -visibleCount)
  const hasOverflow = overflowActions.length > 0

  const renderButton = (item: ActionItem) => {
    if (item.type === 'button') {
      return (
        <Button
          key={item.key}
          variant="outline"
          size="icon"
          aria-label={item.label}
          onClick={item.onClick}
        >
          {item.icon}
        </Button>
      )
    }

    return (
      <Button
        key={item.key}
        variant="outline"
        size="icon"
        aria-label={item.label}
        nativeButton={false}
        render={
          <Link
            href={item.href}
            {...(item.external
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
          />
        }
      >
        {item.icon}
      </Button>
    )
  }

  const renderMenuItem = (item: ActionItem) => {
    if (item.type === 'button') {
      return (
        <DropdownMenuItem key={item.key} onClick={item.onClick}>
          {item.icon}
          {item.label}
        </DropdownMenuItem>
      )
    }

    return (
      <DropdownMenuItem
        key={item.key}
        className="flex items-center gap-2"
        render={
          <Link
            href={item.href}
            {...(item.external
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
          />
        }
      >
        {item.icon}
        {item.label}
      </DropdownMenuItem>
    )
  }

  return (
    <header className="relative max-w-7xl mx-auto z-10">
      <div className="flex h-20 px-4 md:px-6 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear">
        <div
          ref={containerRef}
          className="flex items-center justify-between w-full gap-2 sm:gap-4"
        >
          <div ref={leftRef} className="flex items-center gap-2 min-w-0">
            <Link
              href={homeHref}
              onClick={() => useHeaderResetStore.getState().onReset?.()}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
            >
              <Image
                src="https://wcd.pages.dev/logo.png"
                alt="Chendi Wu Logo"
                width={32}
                height={32}
                className="rounded-full mr-2"
                priority
              />
              <div className="flex flex-col min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold truncate">
                  {siteConfig.name}
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block truncate">
                  {siteConfig.description}
                </p>
              </div>
            </Link>

            {isBack && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => router.back()}
                  className="sm:hidden"
                >
                  <ChevronLeftIcon className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.back()}
                  className="hidden sm:flex"
                >
                  <ChevronLeftIcon className="size-4" />
                  返回
                </Button>
              </>
            )}
          </div>

          <div ref={rightRef} className="flex items-center gap-2 flex-shrink-0">
            <div
              className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground"
              title="在线人数"
              role="status"
            >
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-green-500" />
              </span>
              <span id="liveuser">0</span>
            </div>
            <Script
              src="https://live-user.cdlab.workers.dev/liveuser.js?siteId=flox"
              strategy="afterInteractive"
            />

            {hasOverflow && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="icon" aria-label="更多" />
                  }
                >
                  <MoreHorizontalIcon className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {overflowActions.map((item, i) => (
                    <Fragment key={item.key}>
                      {item.key === 'github' && i > 0 && (
                        <DropdownMenuSeparator />
                      )}
                      {renderMenuItem(item)}
                    </Fragment>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {visibleActions.map(renderButton)}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}

export function Header() {
  return (
    <Suspense fallback={<div className="h-20" />}>
      <HeaderInner />
    </Suspense>
  )
}
