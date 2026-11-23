'use client'

import { Button } from '@cdlab/ui/components/button'
import { Slider } from '@cdlab/ui/components/slider'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@cdlab/ui/components/tooltip'
import { cn } from '@cdlab/ui/lib/utils'
import {
  Camera,
  Maximize,
  Music,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useMemo, useRef } from 'react'
import useDeepCompareEffect from 'use-deep-compare-effect'
import { EditableTimecode } from '@/components/editable-timecode'
import { useContainerSize } from '@/hooks/use-container-size'
import { useEditor } from '@/hooks/use-editor'
import { useFullscreen } from '@/hooks/use-fullscreen'
import { useRafLoop } from '@/hooks/use-raf-loop'
import { invokeAction } from '@/lib/actions'
import { formatTimeCode, getLastFrameTime } from '@/lib/time'
import { CanvasRenderer } from '@/services/renderer/canvas-renderer'
import type { RootNode } from '@/services/renderer/nodes/root-node'
import { buildScene } from '@/services/renderer/scene-builder'
import { useMediaPreviewStore } from '@/stores/media-preview-store'
import type { MediaAsset } from '@/types/assets'
import { firstSliderValue } from '@/utils/slider'
import { PreviewInteractionOverlay } from './preview-interaction-overlay'

function usePreviewSize() {
  const editor = useEditor()
  const activeProject = editor.project.getActive()

  return {
    width: activeProject?.settings.canvasSize.width,
    height: activeProject?.settings.canvasSize.height,
  }
}

function RenderTreeController() {
  const editor = useEditor()
  const tracks = editor.timeline.getTracks()
  const mediaAssets = editor.media.getAssets()
  const activeProject = editor.project.getActive()

  const { width, height } = usePreviewSize()

  useDeepCompareEffect(() => {
    if (!activeProject) return

    const duration = editor.timeline.getTotalDuration()
    const renderTree = buildScene({
      tracks,
      mediaAssets,
      duration,
      canvasSize: { width, height },
      background: activeProject.settings.background,
    })

    editor.renderer.setRenderTree({ renderTree })
  }, [tracks, mediaAssets, activeProject?.settings.background, width, height])

  return null
}

export function PreviewPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isFullscreen, toggleFullscreen } = useFullscreen({ containerRef })
  const editor = useEditor()
  const isAudioProject = editor.project.getActive()?.metadata.type === 'audio'
  const selectedMediaId = useMediaPreviewStore((state) => state.selectedMediaId)
  const clearSelection = useMediaPreviewStore((state) => state.clearSelection)

  const selectedAsset = useMemo(() => {
    if (!selectedMediaId) return null
    return (
      editor.media.getAssets().find((asset) => asset.id === selectedMediaId) ??
      null
    )
  }, [selectedMediaId, editor.media])

  return (
    <div
      ref={containerRef}
      className={cn(
        'panel bg-background relative flex h-full min-h-0 w-full min-w-0 flex-col rounded-sm border',
        isFullscreen && 'bg-background',
      )}
    >
      {selectedAsset ? (
        <>
          <PreviewHeader
            assetName={selectedAsset.name}
            onClose={clearSelection}
          />
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-2">
            <AssetPreviewPlayer asset={selectedAsset} />
          </div>
        </>
      ) : (
        <>
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-2 pb-0">
            {isAudioProject ? (
              <Music className="text-muted-foreground size-24" />
            ) : (
              <>
                <PreviewCanvas />
                <RenderTreeController />
              </>
            )}
          </div>
          <PreviewToolbar
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />
        </>
      )}
    </div>
  )
}

function PreviewHeader({
  assetName,
  onClose,
}: {
  assetName: string
  onClose: () => void
}) {
  return (
    <div className="flex h-9 items-center justify-between border-b px-3">
      <span className="text-muted-foreground truncate text-xs">
        正在预览: {assetName}
      </span>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        className="size-6"
        onClick={onClose}
        title="Close preview"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}

function AssetPreviewPlayer({ asset }: { asset: MediaAsset }) {
  const url = asset.url ?? ''

  if (asset.type === 'video') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <video
          key={asset.id}
          src={url}
          controls
          autoPlay
          className="max-h-full max-w-full rounded"
        />
      </div>
    )
  }

  if (asset.type === 'image') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <img
          src={url}
          alt={asset.name}
          className="max-h-full max-w-full rounded object-contain"
        />
      </div>
    )
  }

  if (asset.type === 'audio') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        <Music className="text-muted-foreground size-16" />
        <span className="text-muted-foreground text-sm">{asset.name}</span>
        <audio key={asset.id} src={url} controls autoPlay className="w-64" />
      </div>
    )
  }

  return null
}

function exportCurrentFrame({
  editor,
}: {
  editor: ReturnType<typeof useEditor>
}) {
  const renderTree = editor.renderer.getRenderTree()
  if (!renderTree) return

  const activeProject = editor.project.getActive()
  if (!activeProject) return

  const { width, height } = activeProject.settings.canvasSize
  const fps = activeProject.settings.fps
  const currentTime = editor.playback.getCurrentTime()

  const renderer = new CanvasRenderer({ width, height, fps })
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = width
  tempCanvas.height = height

  void renderer
    .renderToCanvas({
      node: renderTree,
      time: currentTime,
      targetCanvas: tempCanvas,
    })
    .then(() => {
      tempCanvas.toBlob((blob) => {
        if (!blob) return

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${activeProject.metadata.name}-frame.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 'image/png')
    })
}

function PreviewToolbar({
  isFullscreen,
  onToggleFullscreen,
}: {
  isFullscreen: boolean
  onToggleFullscreen: () => void
}) {
  const t = useTranslations()
  const editor = useEditor()
  const isPlaying = editor.playback.getIsPlaying()
  const currentTime = editor.playback.getCurrentTime()
  const totalDuration = editor.timeline.getTotalDuration()
  const fps = editor.project.getActive().settings.fps

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center pb-3 pt-5 px-5">
      <div className="flex items-center mt-1">
        <EditableTimecode
          time={currentTime}
          duration={totalDuration}
          format="HH:MM:SS:FF"
          fps={fps}
          onTimeChange={({ time }) => editor.playback.seek({ time })}
          className="text-center"
        />
        <span className="text-muted-foreground px-2 font-mono text-xs">/</span>
        <span className="text-muted-foreground font-mono text-xs">
          {formatTimeCode({
            timeInSeconds: totalDuration,
            format: 'HH:MM:SS:FF',
            fps,
          })}
        </span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => invokeAction('toggle-play')}
      >
        {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>

      <div className="flex items-center gap-1 justify-self-end">
        <VolumeControl />
        <Button
          variant="ghost"
          size="icon"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          <Maximize className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => exportCurrentFrame({ editor })}
          title={t('export.currentFrame')}
        >
          <Camera className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function PreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastFrameRef = useRef(-1)
  const lastSceneRef = useRef<RootNode | null>(null)
  const renderingRef = useRef(false)
  const { width: nativeWidth, height: nativeHeight } = usePreviewSize()
  const containerSize = useContainerSize({ containerRef })
  const editor = useEditor()
  const activeProject = editor.project.getActive()

  const renderer = useMemo(() => {
    return new CanvasRenderer({
      width: nativeWidth,
      height: nativeHeight,
      fps: activeProject.settings.fps,
    })
  }, [nativeWidth, nativeHeight, activeProject.settings.fps])

  const displaySize = useMemo(() => {
    if (
      !nativeWidth ||
      !nativeHeight ||
      containerSize.width === 0 ||
      containerSize.height === 0
    ) {
      return { width: nativeWidth ?? 0, height: nativeHeight ?? 0 }
    }

    const paddingBuffer = 4
    const availableWidth = containerSize.width - paddingBuffer
    const availableHeight = containerSize.height - paddingBuffer

    const aspectRatio = nativeWidth / nativeHeight
    const containerAspect = availableWidth / availableHeight

    const displayWidth =
      containerAspect > aspectRatio
        ? availableHeight * aspectRatio
        : availableWidth
    const displayHeight =
      containerAspect > aspectRatio
        ? availableHeight
        : availableWidth / aspectRatio

    return { width: displayWidth, height: displayHeight }
  }, [nativeWidth, nativeHeight, containerSize.width, containerSize.height])

  const renderTree = editor.renderer.getRenderTree()

  const render = useCallback(() => {
    if (canvasRef.current && renderTree && !renderingRef.current) {
      const time = editor.playback.getCurrentTime()
      const lastFrameTime = getLastFrameTime({
        duration: renderTree.duration,
        fps: renderer.fps,
      })
      const renderTime = Math.min(time, lastFrameTime)
      const frame = Math.floor(renderTime * renderer.fps)

      if (
        frame !== lastFrameRef.current ||
        renderTree !== lastSceneRef.current
      ) {
        renderingRef.current = true
        lastSceneRef.current = renderTree
        lastFrameRef.current = frame
        renderer
          .renderToCanvas({
            node: renderTree,
            time: renderTime,
            targetCanvas: canvasRef.current,
          })
          .finally(() => {
            renderingRef.current = false
          })
          .catch((error) => {
            console.error('Preview render failed:', error)
          })
      }
    }
  }, [renderer, renderTree, editor.playback])

  useRafLoop(render)

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center"
    >
      <div
        className="relative"
        style={{ width: displaySize.width, height: displaySize.height }}
      >
        <canvas
          ref={canvasRef}
          width={nativeWidth}
          height={nativeHeight}
          className="block border"
          style={{
            width: displaySize.width,
            height: displaySize.height,
            background:
              activeProject.settings.background.type === 'blur'
                ? 'transparent'
                : activeProject?.settings.background.color,
          }}
        />
        <PreviewInteractionOverlay
          canvasRef={canvasRef}
          displaySize={displaySize}
        />
      </div>
    </div>
  )
}

function VolumeControl() {
  const t = useTranslations()
  const editor = useEditor()
  const volume = editor.playback.getVolume()
  const muted = editor.playback.isMuted()

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider delay={500}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                onClick={() => editor.playback.toggleMute()}
              />
            }
          >
            {muted ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </TooltipTrigger>
          <TooltipContent>
            <p>{muted ? t('common.unmute') : t('common.mute')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Slider
        className="w-20"
        value={[muted ? 0 : volume]}
        onValueChange={(values) =>
          editor.playback.setVolume({ volume: firstSliderValue(values) })
        }
        min={0}
        max={1}
        step={0.01}
      />
    </div>
  )
}
