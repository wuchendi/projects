'use client'

import type { IPlayerConfig } from '@volcengine/veplayer'
import VePlayer, {
  DynamicWatermarkPlugin,
  MemoryPlay,
  MirrorPlugin,
} from '@volcengine/veplayer'
import { useEffect, useRef } from 'react'
import '@volcengine/veplayer/index.min.css'
import { genid } from '@/lib/utils/genid'

interface VideoPlayerProps {
  /** 视频播放地址 */
  url: string
  /** 视频封面地址 */
  poster?: string
  /** 是否自动播放 */
  autoplay?: boolean
  /** 是否开启水印 */
  watermark?: boolean
  /** 起始播放时间（秒） */
  initialTime?: number
  className?: string
  onTimeUpdate?: (currentTime: number, duration: number) => void
}

export function FloxPlayer({
  url,
  poster,
  autoplay = false,
  watermark = false,
  initialTime,
  className,
  onTimeUpdate,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<VePlayer | null>(null)
  const onTimeUpdateRef = useRef(onTimeUpdate)
  onTimeUpdateRef.current = onTimeUpdate

  const extractIdFromUrl = (urlStr: string) => {
    try {
      const urlObj = new URL(urlStr)
      let path = urlObj.pathname

      if (path.endsWith('/index.m3u8')) {
        path = path.slice(0, -12)
      } else if (path.endsWith('index.m3u8')) {
        path = path.slice(0, -11)
      }

      if (path.endsWith('/video')) {
        path = path.slice(0, -6)
      }

      const segments = path.replace(/\/$/, '').split('/')
      const candidate = segments[segments.length - 1]

      const hasChinese = /[一-龥]/.test(candidate)

      if (!candidate || hasChinese) {
        return genid.nextId()
      }

      return candidate
    } catch (error) {
      return genid.nextId()
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: We only want to run this effect when the URL changes, not when poster or autoplay changes
  useEffect(() => {
    if (!containerRef.current || !url) return

    const extractedId = extractIdFromUrl(url)

    const playerId = `flox-video-player-${extractedId}`
    containerRef.current.id = playerId

    const playerConfig: IPlayerConfig = {
      id: playerId,
      url,
      lang: 'zh',
      width: '100%',
      height: '100%',
      streamType: 'hls',
      codec: 'h264',
      poster,
      autoplay,
      startTime: initialTime && initialTime > 0 ? initialTime : undefined,
      rotate: {
        clockwise: false,
        innerRotate: true,
      },
      vodLogOpts: {
        vtype: 'HLS',
        tag: 'Flox',
        subtag: 'Flox Player',
        line_app_id: 920667,
        line_user_id: '123',
      },
      plugins: [MemoryPlay, DynamicWatermarkPlugin, MirrorPlugin],
      MemoryPlay: {
        memoryId: `flox_memory_id_${extractedId}`,
      },
      dynamicwatermark: {
        enable: false,
        content: 'Flox',
        fontSize: 20,
        opacity: 0.2,
      },
    }

    playerRef.current = new VePlayer(playerConfig)

    const handleTimeUpdate = () => {
      const player = playerRef.current
      if (!player || !onTimeUpdateRef.current) return
      const ct = (player as any).currentTime as number | undefined
      const dur = (player as any).duration as number | undefined
      if (ct !== undefined && dur !== undefined) {
        onTimeUpdateRef.current(ct, dur)
      }
    }

    playerRef.current.on('timeupdate', handleTimeUpdate)

    return () => {
      if (playerRef.current) {
        playerRef.current.off?.('timeupdate', handleTimeUpdate)
        void playerRef.current.destroy?.()
        playerRef.current = null
      }
    }
  }, [url, poster, autoplay])

  return <div ref={containerRef} className={className} />
}
