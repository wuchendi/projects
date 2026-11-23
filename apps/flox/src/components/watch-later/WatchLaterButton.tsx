'use client'

import { Button } from '@cdlab/ui/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@cdlab/ui/components/tooltip'
import { cn } from '@cdlab/ui/lib/utils'
import { BookmarkIcon } from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import {
  useIsInWatchLater,
  useToggleWatchLater,
} from '@/lib/store/watch-later-store'

interface WatchLaterButtonProps {
  videoId: string | number
  source: string
  title: string
  poster?: string
  sourceName?: string
  type?: string
  year?: string
  remarks?: string
  className?: string
  size?: number
  showTooltip?: boolean
  isPremium?: boolean
  /** Use plain ghost style (for list item actions). Defaults to card-overlay style. */
  plain?: boolean
}

export const WatchLaterButton = memo<WatchLaterButtonProps>(
  ({
    videoId,
    source,
    title,
    poster,
    sourceName,
    type,
    year,
    remarks,
    className = '',
    size = 20,
    showTooltip = true,
    isPremium = false,
    plain = false,
  }) => {
    const inQueue = useIsInWatchLater(videoId, source, isPremium)
    const toggleWatchLater = useToggleWatchLater(isPremium)
    const [isAnimating, setIsAnimating] = useState(false)

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        setIsAnimating(true)
        toggleWatchLater({
          videoId,
          source,
          title,
          poster,
          sourceName,
          type,
          year,
          remarks,
        })
        setTimeout(() => setIsAnimating(false), 300)
      },
      [
        videoId,
        source,
        title,
        poster,
        sourceName,
        type,
        year,
        remarks,
        toggleWatchLater,
      ],
    )

    const button = (
      <Button
        variant="ghost"
        size={plain ? 'icon-xs' : 'icon'}
        onClick={handleClick}
        aria-label={inQueue ? '从稍后观看移除' : '加入稍后观看'}
        className={cn(
          !plain &&
            'rounded-full bg-background/95 backdrop-blur-sm border border-border hover:scale-110 active:scale-95 transition-all duration-200 ease-out',
          !plain && isAnimating && 'scale-125',
          className,
        )}
      >
        <BookmarkIcon
          size={size}
          className={
            inQueue
              ? 'text-primary transition-colors'
              : 'text-muted-foreground hover:text-primary transition-colors'
          }
          fill={inQueue ? 'currentColor' : 'none'}
          style={
            inQueue
              ? {
                  transform: isAnimating ? 'scale(1.2)' : 'scale(1)',
                  filter: 'drop-shadow(0 0 4px rgba(99, 102, 241, 0.4))',
                }
              : undefined
          }
        />
      </Button>
    )

    if (!showTooltip) return button

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={button} />
          <TooltipContent>
            {inQueue ? '从稍后观看移除' : '加入稍后观看'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  },
)

WatchLaterButton.displayName = 'WatchLaterButton'
