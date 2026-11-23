'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import { ButtonGroup } from '@cdlab/ui/components/button-group'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import { CopyButton } from '@cdlab/ui/components/copy-button'
import { ScrollArea } from '@cdlab/ui/components/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@cdlab/ui/components/tooltip'
import { IKEmpty } from '@cdlab/ui/IK'
import {
  ArrowUpDownIcon,
  DownloadIcon,
  InboxIcon,
  ListIcon,
} from 'lucide-react'
import { useCallback, useMemo, useRef } from 'react'

const VIDL_URL = 'https://vidl.pages.dev'

import { useKeyboardNavigation } from '@/lib/hooks/useKeyboardNavigation'

interface Episode {
  name?: string
  url: string
}

interface EpisodeListProps {
  episodes: Episode[] | null
  currentEpisode: number
  isReversed?: boolean
  onEpisodeClick: (episode: Episode, index: number) => void
  onToggleReverse?: (reversed: boolean) => void
  scrollHeight?: string
}

export function EpisodeList({
  episodes,
  currentEpisode,
  isReversed = false,
  onEpisodeClick,
  onToggleReverse,
  scrollHeight = '400px',
}: EpisodeListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  const displayEpisodes = useMemo(() => {
    if (!episodes) return null
    return isReversed ? [...episodes].reverse() : episodes
  }, [episodes, isReversed])

  const getOriginalIndex = useCallback(
    (displayIndex: number) => {
      if (!episodes || !isReversed) return displayIndex
      return episodes.length - 1 - displayIndex
    },
    [episodes, isReversed],
  )

  const getDisplayIndex = useCallback(
    (originalIndex: number) => {
      if (!episodes || !isReversed) return originalIndex
      return episodes.length - 1 - originalIndex
    },
    [episodes, isReversed],
  )

  useKeyboardNavigation({
    enabled: true,
    containerRef: listRef,
    currentIndex: getDisplayIndex(currentEpisode),
    itemCount: episodes?.length || 0,
    orientation: 'vertical',
    onNavigate: useCallback((index: number) => {
      buttonRefs.current[index]?.focus()
      buttonRefs.current[index]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }, []),
    onSelect: useCallback(
      (displayIndex: number) => {
        if (episodes) {
          const originalIndex = getOriginalIndex(displayIndex)
          if (episodes[originalIndex]) {
            onEpisodeClick(episodes[originalIndex], originalIndex)
          }
        }
      },
      [episodes, onEpisodeClick, getOriginalIndex],
    ),
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ListIcon className="size-4" />
          <CardTitle>选集</CardTitle>
          {episodes && <Badge variant="secondary">{episodes.length}</Badge>}
        </div>

        {episodes && episodes.length > 1 && (
          <CardAction>
            <ButtonGroup>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <CopyButton
                      value={episodes.map((e) => e.url).join('\n')}
                      variant="outline"
                      size="icon-xs"
                      aria-label="复制全部播放地址"
                    />
                  }
                />
                <TooltipContent>复制全部播放地址</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant={isReversed ? 'default' : 'outline'}
                      size="icon-xs"
                      onClick={() => onToggleReverse?.(!isReversed)}
                      aria-label={isReversed ? '恢复正序' : '倒序排列'}
                    />
                  }
                >
                  <ArrowUpDownIcon className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>
                  {isReversed ? '恢复正序' : '倒序排列'}
                </TooltipContent>
              </Tooltip>
            </ButtonGroup>
          </CardAction>
        )}
      </CardHeader>

      <CardContent>
        <style>{`
          .episode-list-scroll [data-slot="scroll-area-viewport"] {
            max-height: ${scrollHeight};
          }
          .episode-list-scroll [data-slot="scroll-area-viewport"] > div {
            display: block !important;
          }
        `}</style>
        <ScrollArea className="episode-list-scroll">
          <div
            ref={listRef}
            className="space-y-1 pr-1"
            role="radiogroup"
            aria-label="剧集选择"
          >
            {displayEpisodes && displayEpisodes.length > 0 ? (
              displayEpisodes.map((episode, displayIndex) => {
                const originalIndex = getOriginalIndex(displayIndex)
                const isCurrentEpisode = currentEpisode === originalIndex

                return (
                  <ButtonGroup key={originalIndex} className="w-full">
                    <Button
                      ref={(el) => {
                        buttonRefs.current[displayIndex] = el
                      }}
                      variant={isCurrentEpisode ? 'default' : 'outline'}
                      className="min-w-0 flex-1 justify-start whitespace-normal"
                      onClick={() => onEpisodeClick(episode, originalIndex)}
                      role="radio"
                      aria-checked={isCurrentEpisode}
                    >
                      <span className="min-w-0 flex-1 line-clamp-1 text-left break-all">
                        {episode.name || `第 ${originalIndex + 1} 集`}
                      </span>
                    </Button>

                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <CopyButton
                            value={episode.url}
                            variant={isCurrentEpisode ? 'default' : 'outline'}
                            size="icon"
                            aria-label={`复制第 ${originalIndex + 1} 集链接`}
                          />
                        }
                      />
                      <TooltipContent>复制播放地址</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant={isCurrentEpisode ? 'default' : 'outline'}
                            size="icon"
                            aria-label={`下载第 ${originalIndex + 1} 集`}
                            nativeButton={false}
                            render={
                              <a
                                href={`${VIDL_URL}/zh?url=${encodeURIComponent(episode.url)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            }
                          />
                        }
                      >
                        <DownloadIcon className="size-4" />
                      </TooltipTrigger>
                      <TooltipContent>在 vidl 中下载</TooltipContent>
                    </Tooltip>
                  </ButtonGroup>
                )
              })
            ) : (
              <IKEmpty
                title="暂无剧集信息"
                icon={InboxIcon}
                iconClassName="size-10 opacity-50"
                className="py-12"
              />
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
