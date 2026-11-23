'use client'

import { Button } from '@cdlab/ui/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@cdlab/ui/components/tooltip'
import { cn } from '@cdlab/ui/lib/utils'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  TAB_KEYS,
  tabs,
  useAssetsPanelStore,
} from '@/stores/assets-panel-store'

export function TabBar() {
  const t = useTranslations()
  const { activeTab, setActiveTab } = useAssetsPanelStore()

  // i18next-toolkit: forces extraction of tab labels (dead code, extract-only)
  if (false as boolean) {
    t('assets.media')
    t('sounds.title')
    t('common.text')
    t('assets.stickers')
    t('assets.effects')
    t('assets.transitions')
    t('assets.captions')
    t('assets.filters')
    t('properties.adjustment')
    t('misc.ai')
    t('common.settings')
  }
  const [showTopFade, setShowTopFade] = useState(false)
  const [showBottomFade, setShowBottomFade] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const checkScrollPosition = useCallback(() => {
    const element = scrollRef.current
    if (!element) return

    const { scrollTop, scrollHeight, clientHeight } = element
    setShowTopFade(scrollTop > 0)
    setShowBottomFade(scrollTop < scrollHeight - clientHeight - 1)
  }, [])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    checkScrollPosition()
    element.addEventListener('scroll', checkScrollPosition)

    const resizeObserver = new ResizeObserver(checkScrollPosition)
    resizeObserver.observe(element)

    return () => {
      element.removeEventListener('scroll', checkScrollPosition)
      resizeObserver.disconnect()
    }
  }, [checkScrollPosition])

  return (
    <div className="relative flex">
      <div
        ref={scrollRef}
        className="scrollbar-hidden relative flex size-full p-2 flex-col items-center justify-start gap-1.5 overflow-y-auto"
      >
        {TAB_KEYS.map((tabKey) => {
          const tab = tabs[tabKey]
          return (
            <Tooltip key={tabKey}>
              <TooltipTrigger
                delay={10}
                render={
                  <Button
                    variant={activeTab === tabKey ? 'secondary' : 'ghost'}
                    aria-label={t(tab.label)}
                    className={cn(
                      'flex-col p-1.5! rounded-sm! h-auto! [&_svg]:size-4.5',
                      activeTab !== tabKey &&
                        'border border-transparent text-muted-foreground',
                    )}
                    onClick={() => setActiveTab(tabKey)}
                  />
                }
              >
                <tab.icon />
              </TooltipTrigger>
              <TooltipContent side="right" align="center" sideOffset={8}>
                {t(tab.label)}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      <FadeOverlay direction="top" show={showTopFade} />
      <FadeOverlay direction="bottom" show={showBottomFade} />
    </div>
  )
}

function FadeOverlay({
  direction,
  show,
}: {
  direction: 'top' | 'bottom'
  show: boolean
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute right-0 left-0 h-6',
        direction === 'top' && show
          ? 'from-background top-0 bg-linear-to-b to-transparent'
          : 'from-background bottom-0 bg-linear-to-t to-transparent',
      )}
    />
  )
}
