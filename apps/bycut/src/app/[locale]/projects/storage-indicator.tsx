'use client'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cdlab/ui/components/popover'
import { Progress } from '@cdlab/ui/components/progress'
import { cn } from '@cdlab/ui/lib/utils'
import { formatBytes } from '@cdlab/utils'
import { Image, Music, Video } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { storageService } from '@/services/storage/service'
import type { StorageStats } from '@/services/storage/types'

const RING_SIZE = 32
const RING_STROKE = 3
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function getUsageColor({ percent }: { percent: number }): string {
  if (percent >= 90) return 'text-red-500'
  if (percent >= 70) return 'text-yellow-500'
  return 'text-emerald-500'
}

function getUsageStrokeColor({ percent }: { percent: number }): string {
  if (percent >= 90) return 'stroke-red-500'
  if (percent >= 70) return 'stroke-yellow-500'
  return 'stroke-emerald-500'
}

function CircularProgressRing({
  percent,
  className,
}: {
  percent: number
  className?: string
}) {
  const clampedPercent = Math.min(100, Math.max(0, percent))
  const offset = RING_CIRCUMFERENCE * (1 - clampedPercent / 100)

  return (
    <svg
      width={RING_SIZE}
      height={RING_SIZE}
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        className="stroke-muted"
        strokeWidth={RING_STROKE}
      />
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        className={getUsageStrokeColor({ percent: clampedPercent })}
        strokeWidth={RING_STROKE}
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
      />
    </svg>
  )
}

const MEDIA_TYPE_CONFIG = [
  { type: 'video' as const, Icon: Video },
  { type: 'image' as const, Icon: Image },
  { type: 'audio' as const, Icon: Music },
] as const

const MEDIA_TYPE_LABELS: Record<string, string> = {
  video: 'Video',
  image: 'Image',
  audio: 'Audio',
}

const HOVER_CLOSE_DELAY = 150

export function StorageIndicator() {
  const t = useTranslations()
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    storageService.getDetailedStorageStats().then(setStats).catch(console.error)
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setIsOpen(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, HOVER_CLOSE_DELAY)
  }, [])

  const usagePercent =
    stats && stats.quota > 0 ? Math.round((stats.usage / stats.quota) * 100) : 0

  const totalMediaSize =
    stats?.projects.reduce((sum, project) => sum + project.mediaSize, 0) ?? 0

  const aggregatedByType = stats?.projects.reduce(
    (acc, project) => {
      for (const [type, data] of Object.entries(project.byType)) {
        const key = type as keyof typeof acc
        if (acc[key]) {
          acc[key].size += data.size
          acc[key].count += data.count
        } else {
          acc[key] = { size: data.size, count: data.count }
        }
      }
      return acc
    },
    {} as Record<string, { size: number; count: number }>,
  )

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        render={
          <button
            type="button"
            className="relative flex items-center justify-center rounded-full p-1 hover:bg-accent transition-colors"
            aria-label={t('projects.storageUsage')}
          />
        }
      >
        <CircularProgressRing percent={usagePercent} />
        <span
          className={cn(
            'absolute text-[8px] font-bold leading-none',
            getUsageColor({ percent: usagePercent }),
          )}
        >
          {stats ? `${usagePercent}%` : '—'}
        </span>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 p-0"
        side="bottom"
        align="end"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        initialFocus={false}
      >
        {!stats ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {t('common.loading')}
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Overall usage */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {t('projects.storage')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatBytes({ bytes: stats.usage })} /{' '}
                  {formatBytes({ bytes: stats.quota })}
                </span>
              </div>
              <Progress value={usagePercent} className="h-1.5" />
            </div>

            {/* Per-type breakdown */}
            <div className="p-4 border-b">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('projects.byType')}
              </span>
              <div className="mt-2 flex flex-col gap-2">
                {MEDIA_TYPE_CONFIG.map(({ type, Icon }) => {
                  const data = aggregatedByType?.[type]
                  if (!data) return null
                  return (
                    <div
                      key={type}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="size-3.5 text-muted-foreground" />
                        <span>{MEDIA_TYPE_LABELS[type]}</span>
                        <span className="text-xs text-muted-foreground">
                          ({data.count})
                        </span>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {formatBytes({ bytes: data.size })}
                      </span>
                    </div>
                  )
                })}
                {(!aggregatedByType ||
                  Object.keys(aggregatedByType).length === 0) && (
                  <span className="text-xs text-muted-foreground">
                    {t('media.noFiles')}
                  </span>
                )}
              </div>
            </div>

            {/* Per-project breakdown */}
            <div className="p-4 max-h-48 overflow-y-auto">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('projects.byProject')}
              </span>
              <div className="mt-2 flex flex-col gap-2">
                {stats.projects.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {t('projects.noProjectsShort')}
                  </span>
                ) : (
                  stats.projects.map((project) => {
                    const projectPercent =
                      totalMediaSize > 0
                        ? (project.mediaSize / totalMediaSize) * 100
                        : 0
                    return (
                      <div
                        key={project.projectId}
                        className="flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm truncate max-w-[180px]">
                            {project.projectName}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatBytes({ bytes: project.mediaSize })}
                          </span>
                        </div>
                        <Progress value={projectPercent} className="h-1" />
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
