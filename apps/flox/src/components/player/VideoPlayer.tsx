'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import { Card } from '@cdlab/ui/components/card'
import { Label } from '@cdlab/ui/components/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cdlab/ui/components/popover'
import { Switch } from '@cdlab/ui/components/switch'
import { ToggleGroup, ToggleGroupItem } from '@cdlab/ui/components/toggle-group'
import { cn } from '@cdlab/ui/lib/utils'
import { SettingsIcon } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useHistory } from '@/lib/store/history-store'
import type { AdFilterMode } from '@/lib/store/settings-store'
import { CustomVideoPlayer } from './CustomVideoPlayer'
import { FloxPlayer } from './FloxPlayer'
import { usePlayerSettings } from './hooks/usePlayerSettings'
import type { VideoResolutionInfo } from './hooks/useVideoResolution'
import { getCopyUrl } from './utils/urlUtils'
import { VideoPlayerEmpty } from './VideoPlayerEmpty'
import { VideoPlayerError } from './VideoPlayerError'

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

const AD_FILTER_OPTIONS: { value: AdFilterMode; label: string }[] = [
  { value: 'off', label: '关闭' },
  { value: 'heuristic', label: '启发' },
  { value: 'aggressive', label: '激进' },
]

const SKIP_PRESETS = [15, 30, 45, 60, 90, 120]

interface VideoPlayerProps {
  playUrl: string
  poster?: string
  videoId?: string
  currentEpisode: number
  onBack: () => void
  totalEpisodes?: number
  onNextEpisode?: () => void
  isReversed?: boolean
  isPremium?: boolean
  externalTimeRef?: React.RefObject<number>
  onResolutionDetected?: (info: VideoResolutionInfo) => void
}

export function VideoPlayer({
  playUrl,
  poster,
  videoId,
  currentEpisode,
  onBack,
  totalEpisodes,
  onNextEpisode,
  isReversed = false,
  isPremium = false,
  externalTimeRef,
  onResolutionDetected,
}: VideoPlayerProps) {
  const [videoError, setVideoError] = useState<string>('')
  const [useProxy, setUseProxy] = useState(false)
  const [shouldAutoPlay, setShouldAutoPlay] = useState(true)
  const [retryCount, setRetryCount] = useState(0)
  const [resolution, setResolution] = useState<VideoResolutionInfo | null>(null)
  const MAX_MANUAL_RETRIES = 20
  const lastSaveTimeRef = useRef(0)
  const currentTimeRef = useRef(0)
  const durationRef = useRef(0)
  const switchTimeRef = useRef(0)
  const SAVE_INTERVAL = 5000

  const {
    proxyMode,
    showModeIndicator,
    setShowModeIndicator,
    playbackRate,
    setPlaybackRate,
    adFilterMode,
    setAdFilterMode,
    autoNextEpisode,
    setAutoNextEpisode,
    autoSkipIntro,
    setAutoSkipIntro,
    skipIntroSeconds,
    setSkipIntroSeconds,
    autoSkipOutro,
    setAutoSkipOutro,
    skipOutroSeconds,
    setSkipOutroSeconds,
    fullscreenType,
    setFullscreenType,
    playerEngine,
    setPlayerEngine,
  } = usePlayerSettings()

  const effectiveUseProxy =
    proxyMode === 'always' ? true : proxyMode === 'none' ? false : useProxy

  // Sync useProxy with global proxyMode setting
  useEffect(() => {
    if (proxyMode === 'always') setUseProxy(true)
    else if (proxyMode === 'none') setUseProxy(false)
  }, [proxyMode])

  const { viewingHistory, addToHistory } = useHistory(isPremium)
  const searchParams = useSearchParams()
  const source = searchParams.get('source') || ''
  const title = searchParams.get('title') || '未知视频'

  const getSavedProgress = () => {
    // Check for explicit time param (from seamless source switch)
    const timeParam = searchParams.get('t')
    if (timeParam) {
      const t = parseFloat(timeParam)
      if (t > 0 && isFinite(t)) return t
    }

    if (!videoId) return 0
    return (
      viewingHistory.find(
        (item) =>
          item.videoId.toString() === videoId.toString() &&
          item.episodeIndex === currentEpisode &&
          (source ? item.source === source : true),
      )?.playbackPosition ||
      viewingHistory.find(
        (item) =>
          item.videoId.toString() === videoId.toString() &&
          item.episodeIndex === currentEpisode,
      )?.playbackPosition ||
      0
    )
  }

  const saveProgress = useCallback(
    (currentTime: number, duration: number) => {
      if (!videoId || !playUrl || duration === 0 || currentTime <= 1) return
      addToHistory(
        videoId,
        title,
        playUrl,
        currentEpisode,
        source,
        currentTime,
        duration,
        undefined,
        [],
      )
    },
    [videoId, playUrl, title, currentEpisode, source, addToHistory],
  )

  const handleTimeUpdate = useCallback(
    (currentTime: number, duration: number) => {
      currentTimeRef.current = currentTime
      durationRef.current = duration
      if (externalTimeRef) externalTimeRef.current = currentTime
      if (!videoId || !playUrl || duration === 0) return
      const now = Date.now()
      if (currentTime > 1 && now - lastSaveTimeRef.current >= SAVE_INTERVAL) {
        lastSaveTimeRef.current = now
        saveProgress(currentTime, duration)
      }
    },
    [videoId, playUrl, saveProgress, externalTimeRef],
  )

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentTimeRef.current > 1 && durationRef.current > 0) {
        saveProgress(currentTimeRef.current, durationRef.current)
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saveProgress])

  const handleVideoError = (error: string) => {
    if (!effectiveUseProxy && proxyMode === 'retry') {
      setUseProxy(true)
      setShouldAutoPlay(true)
      setVideoError('')
      return
    }
    setVideoError(error)
  }

  const handleRetry = () => {
    if (retryCount >= MAX_MANUAL_RETRIES) return
    setRetryCount((prev) => prev + 1)
    setVideoError('')
    setShouldAutoPlay(true)
    setUseProxy((prev) => (proxyMode === 'none' ? false : !prev))
  }

  const toggleProxy = () => {
    setUseProxy((prev) => !prev)
    setVideoError('')
    setRetryCount(0)
  }

  const switchEngine = (engine: typeof playerEngine) => {
    switchTimeRef.current = currentTimeRef.current
    setPlayerEngine(engine)
    setVideoError('')
  }

  const cycleSkipSeconds = (current: number, setter: (v: number) => void) => {
    const next =
      SKIP_PRESETS[(SKIP_PRESETS.indexOf(current) + 1) % SKIP_PRESETS.length]
    setter(next ?? 30)
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getCopyUrl(playUrl, 'original'))
      toast.success('链接已复制到剪贴板')
    } catch {
      toast.error('复制失败，请重试')
    }
  }

  const finalPlayUrl = effectiveUseProxy
    ? `/api/proxy?url=${encodeURIComponent(playUrl)}&retry=${retryCount}`
    : playUrl

  if (!playUrl) return <VideoPlayerEmpty />

  const hasMultipleEpisodes = (totalEpisodes ?? 0) > 1
  const canToggleProxy = proxyMode === 'retry'

  return (
    <div className="space-y-4">
      <div data-no-spatial className="relative">
        {playerEngine === 'veplayer' ? (
          <FloxPlayer
            url={finalPlayUrl}
            autoplay
            poster={poster}
            initialTime={
              switchTimeRef.current > 0
                ? switchTimeRef.current
                : getSavedProgress()
            }
            onTimeUpdate={handleTimeUpdate}
            className="aspect-video w-full bg-black"
          />
        ) : videoError ? (
          <VideoPlayerError
            error={videoError}
            onBack={onBack}
            onRetry={handleRetry}
            retryCount={retryCount}
            maxRetries={MAX_MANUAL_RETRIES}
          />
        ) : (
          <CustomVideoPlayer
            key={`${effectiveUseProxy ? 'proxy' : 'direct'}-${retryCount}-${source}`}
            src={finalPlayUrl}
            poster={poster}
            onError={handleVideoError}
            onTimeUpdate={handleTimeUpdate}
            initialTime={
              switchTimeRef.current > 0
                ? switchTimeRef.current
                : getSavedProgress()
            }
            shouldAutoPlay={shouldAutoPlay}
            totalEpisodes={totalEpisodes}
            currentEpisodeIndex={currentEpisode}
            onNextEpisode={onNextEpisode}
            isReversed={isReversed}
            isPremium={isPremium}
            onResolutionDetected={(info) => {
              setResolution(info)
              onResolutionDetected?.(info)
            }}
          />
        )}
      </div>

      <Card className="px-3 sm:px-4">
        <div className="flex items-center gap-2 flex-wrap">
          <ToggleGroup
            size="sm"
            variant="outline"
            value={[String(playbackRate)]}
            onValueChange={(v) => v[0] && setPlaybackRate(Number(v[0]))}
            aria-label="播放速度"
            className="flex-nowrap"
          >
            {SPEED_OPTIONS.map((s) => (
              <ToggleGroupItem key={s} value={String(s)} aria-label={`${s}x`}>
                {s === 1 ? '1x' : `${s}x`}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="flex items-center gap-1.5 ml-auto">
            {resolution && (
              <Badge className={cn('hidden sm:inline-flex', resolution.color)}>
                {resolution.label}
              </Badge>
            )}
            {showModeIndicator && (
              <Badge
                variant={effectiveUseProxy ? 'destructive' : 'secondary'}
                onClick={canToggleProxy ? toggleProxy : undefined}
                className={cn(
                  'select-none',
                  canToggleProxy && 'cursor-pointer',
                )}
              >
                {effectiveUseProxy ? '代理' : '直连'}
              </Badge>
            )}

            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="播放设置"
                  />
                }
              >
                <SettingsIcon className="size-4" />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-0">
                <div className="px-4 py-3 border-b">
                  <p className="text-sm font-medium">播放设置</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    全局生效，下次播放保留
                  </p>
                </div>

                <div className="px-4 py-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs">播放引擎</Label>
                    <ToggleGroup
                      size="sm"
                      variant="outline"
                      value={[playerEngine]}
                      onValueChange={(v) =>
                        v[0] && switchEngine(v[0] as typeof playerEngine)
                      }
                      aria-label="播放引擎"
                    >
                      <ToggleGroupItem value="veplayer">
                        VePlayer
                      </ToggleGroupItem>
                      <ToggleGroupItem value="native">原生</ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs">广告过滤</Label>
                    <ToggleGroup
                      size="sm"
                      variant="outline"
                      value={[adFilterMode]}
                      onValueChange={(v) =>
                        v[0] && setAdFilterMode(v[0] as AdFilterMode)
                      }
                      aria-label="广告过滤"
                    >
                      {AD_FILTER_OPTIONS.map(({ value, label }) => (
                        <ToggleGroupItem key={value} value={value}>
                          {label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs">全屏方式</Label>
                    <ToggleGroup
                      size="sm"
                      variant="outline"
                      value={[fullscreenType]}
                      onValueChange={(v) =>
                        v[0] && setFullscreenType(v[0] as 'native' | 'window')
                      }
                      aria-label="全屏方式"
                    >
                      <ToggleGroupItem value="native">系统</ToggleGroupItem>
                      <ToggleGroupItem value="window">网页</ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="mode-indicator"
                      className="text-xs cursor-pointer"
                    >
                      模式指示器
                    </Label>
                    <Switch
                      id="mode-indicator"
                      checked={showModeIndicator}
                      onCheckedChange={setShowModeIndicator}
                    />
                  </div>

                  {hasMultipleEpisodes && (
                    <div className="flex items-center justify-between gap-2">
                      <Label
                        htmlFor="autoplay-next"
                        className="text-xs cursor-pointer"
                      >
                        自动播放下一集
                      </Label>
                      <Switch
                        id="autoplay-next"
                        checked={autoNextEpisode}
                        onCheckedChange={setAutoNextEpisode}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="skip-intro"
                      className="text-xs cursor-pointer flex-1"
                    >
                      跳过片头
                    </Label>
                    {autoSkipIntro && (
                      <button
                        type="button"
                        className="text-xs text-primary underline underline-offset-2 tabular-nums"
                        onClick={() =>
                          cycleSkipSeconds(
                            skipIntroSeconds,
                            setSkipIntroSeconds,
                          )
                        }
                        title="点击切换秒数"
                      >
                        {skipIntroSeconds}s
                      </button>
                    )}
                    <Switch
                      id="skip-intro"
                      checked={autoSkipIntro}
                      onCheckedChange={setAutoSkipIntro}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="skip-outro"
                      className="text-xs cursor-pointer flex-1"
                    >
                      跳过片尾
                    </Label>
                    {autoSkipOutro && (
                      <button
                        type="button"
                        className="text-xs text-primary underline underline-offset-2 tabular-nums"
                        onClick={() =>
                          cycleSkipSeconds(
                            skipOutroSeconds,
                            setSkipOutroSeconds,
                          )
                        }
                        title="点击切换秒数"
                      >
                        {skipOutroSeconds}s
                      </button>
                    )}
                    <Switch
                      id="skip-outro"
                      checked={autoSkipOutro}
                      onCheckedChange={setAutoSkipOutro}
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleCopyLink}
                  >
                    复制链接
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </Card>
    </div>
  )
}
