'use client'

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@cdlab/ui/components/context-menu'
import {
  ArrowLeftRight,
  AudioLines,
  Copy,
  Eye,
  EyeOff,
  FlipHorizontal,
  Music,
  Pencil,
  Scissors,
  Search,
  Trash2,
  Undo2,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { ComponentProps } from 'react'
import { TIMELINE_CONSTANTS } from '@/constants/timeline-constants'
import { useTimelineElementResize } from '@/hooks/timeline/element/use-element-resize'
import { useElementSelection } from '@/hooks/timeline/element/use-element-selection'
import type { SnapPoint } from '@/hooks/timeline/use-timeline-snapping'
import { useEditor } from '@/hooks/use-editor'
import type { TAction } from '@/lib/actions'
import { getActionDefinition, invokeAction } from '@/lib/actions'
import { mediaSupportsAudio } from '@/lib/media/media-utils'
import {
  canElementBeHidden,
  canElementHaveAudio,
  getTrackClasses,
  getTrackHeight,
  hasMediaId,
} from '@/lib/timeline'
import { useAssetsPanelStore } from '@/stores/assets-panel-store'
import type { MediaAsset } from '@/types/assets'
import type {
  ElementDragState,
  TimelineElement as TimelineElementType,
  TimelineTrack,
  VideoElement,
} from '@/types/timeline'
import { uppercase } from '@/utils/string'
import AudioWaveform from './audio-waveform'
import { VideoThumbnailStrip } from './video-thumbnail-strip'

function getDisplayShortcut(action: TAction) {
  const { defaultShortcuts } = getActionDefinition(action)
  if (!defaultShortcuts?.length) {
    return ''
  }

  return uppercase({
    string: defaultShortcuts[0].replace('+', ' '),
  })
}

interface TimelineElementProps {
  element: TimelineElementType
  track: TimelineTrack
  zoomLevel: number
  isSelected: boolean
  onSnapPointChange?: (snapPoint: SnapPoint | null) => void
  onResizeStateChange?: (params: { isResizing: boolean }) => void
  onElementMouseDown: (
    e: React.MouseEvent,
    element: TimelineElementType,
  ) => void
  onElementClick: (e: React.MouseEvent, element: TimelineElementType) => void
  dragState: ElementDragState
}

export function TimelineElement({
  element,
  track,
  zoomLevel,
  isSelected,
  onSnapPointChange,
  onResizeStateChange,
  onElementMouseDown,
  onElementClick,
  dragState,
}: TimelineElementProps) {
  const t = useTranslations()
  const editor = useEditor()
  const { selectedElements } = useElementSelection()
  const { requestRevealMedia } = useAssetsPanelStore()

  const mediaAssets = editor.media.getAssets()
  let mediaAsset: MediaAsset | null = null

  if (hasMediaId(element)) {
    mediaAsset =
      mediaAssets.find((asset) => asset.id === element.mediaId) ?? null
  }

  const hasAudio = mediaSupportsAudio({ media: mediaAsset })

  const { handleResizeStart, isResizing, currentStartTime, currentDuration } =
    useTimelineElementResize({
      element,
      track,
      zoomLevel,
      onSnapPointChange,
      onResizeStateChange,
    })

  const isCurrentElementSelected = selectedElements.some(
    (selected) =>
      selected.elementId === element.id && selected.trackId === track.id,
  )

  const isBeingDragged = dragState.elementId === element.id
  const isBatchDragged =
    !isBeingDragged &&
    dragState.isDragging &&
    isCurrentElementSelected &&
    selectedElements.length > 1
  const timeDelta = dragState.isDragging
    ? dragState.currentTime - dragState.startElementTime
    : 0
  const dragOffsetY =
    isBeingDragged && dragState.isDragging
      ? dragState.currentMouseY - dragState.startMouseY
      : 0
  const elementStartTime =
    isBeingDragged && dragState.isDragging
      ? dragState.currentTime
      : isBatchDragged
        ? Math.max(0, element.startTime + timeDelta)
        : element.startTime
  const displayedStartTime = isResizing ? currentStartTime : elementStartTime
  const displayedDuration = isResizing ? currentDuration : element.duration
  const elementWidth =
    displayedDuration * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel
  const elementLeft = displayedStartTime * 50 * zoomLevel

  const handleRevealInMedia = ({ event }: { event: React.MouseEvent }) => {
    event.stopPropagation()
    if (hasMediaId(element)) {
      requestRevealMedia(element.mediaId)
    }
  }

  const isMuted = canElementHaveAudio(element) && element.muted === true

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            className={`absolute top-0 h-full select-none ${
              isBeingDragged ? 'z-30' : 'z-10'
            }`}
            style={{
              left: `${elementLeft}px`,
              width: `${elementWidth}px`,
              transform:
                isBeingDragged && dragState.isDragging
                  ? `translate3d(0, ${dragOffsetY}px, 0)`
                  : undefined,
            }}
          />
        }
      >
        <ElementInner
          element={element}
          track={track}
          zoomLevel={zoomLevel}
          isSelected={isSelected}
          isBeingDragged={isBeingDragged}
          hasAudio={hasAudio}
          isMuted={isMuted}
          mediaAssets={mediaAssets}
          onElementClick={onElementClick}
          onElementMouseDown={onElementMouseDown}
          handleResizeStart={handleResizeStart}
        />
      </ContextMenuTrigger>
      <ContextMenuContent className="z-200 w-64">
        <ActionMenuItem action="split" icon={<Scissors className="size-4" />}>
          {t('timeline.split')}
        </ActionMenuItem>
        <CopyMenuItem />
        {canElementHaveAudio(element) && hasAudio && (
          <>
            <MuteMenuItem
              isMultipleSelected={selectedElements.length > 1}
              isCurrentElementSelected={isCurrentElementSelected}
              isMuted={isMuted}
            />
            {element.type === 'video' && (
              <ActionMenuItem
                action="detach-audio"
                icon={<Music className="size-4" />}
              >
                {t('timeline.detachAudio')}
              </ActionMenuItem>
            )}
          </>
        )}
        {element.type === 'video' && selectedElements.length === 1 && (
          <VideoEditSubmenu
            element={element as VideoElement}
            trackId={track.id}
          />
        )}
        {element.type === 'text' && (
          <ActionMenuItem
            action="convert-to-speech"
            icon={<AudioLines className="size-4" />}
          >
            {selectedElements.length > 1
              ? t('tts.convertCount', {
                  count: selectedElements.length,
                })
              : t('tts.convert')}
          </ActionMenuItem>
        )}
        {canElementBeHidden(element) && (
          <VisibilityMenuItem
            element={element}
            isMultipleSelected={selectedElements.length > 1}
            isCurrentElementSelected={isCurrentElementSelected}
          />
        )}
        {selectedElements.length === 1 && (
          <ActionMenuItem
            action="duplicate-selected"
            icon={<Copy className="size-4" />}
          >
            {t('common.duplicate')}
          </ActionMenuItem>
        )}
        {selectedElements.length === 1 && hasMediaId(element) && (
          <>
            <ContextMenuItem
              onClick={(event) => handleRevealInMedia({ event })}
            >
              <Search className="size-4" />
              {t('timeline.revealMedia')}
            </ContextMenuItem>
            <ContextMenuItem disabled>
              <ArrowLeftRight className="size-4" />
              {t('timeline.replaceMedia')}
            </ContextMenuItem>
          </>
        )}
        <ContextMenuSeparator />
        <DeleteMenuItem
          isMultipleSelected={selectedElements.length > 1}
          isCurrentElementSelected={isCurrentElementSelected}
          elementType={element.type}
          selectedCount={selectedElements.length}
        />
      </ContextMenuContent>
    </ContextMenu>
  )
}

function ElementInner({
  element,
  track,
  zoomLevel,
  isSelected,
  isBeingDragged,
  hasAudio,
  isMuted,
  mediaAssets,
  onElementClick,
  onElementMouseDown,
  handleResizeStart,
}: {
  element: TimelineElementType
  track: TimelineTrack
  zoomLevel: number
  isSelected: boolean
  isBeingDragged: boolean
  hasAudio: boolean
  isMuted: boolean
  mediaAssets: MediaAsset[]
  onElementClick: (e: React.MouseEvent, element: TimelineElementType) => void
  onElementMouseDown: (
    e: React.MouseEvent,
    element: TimelineElementType,
  ) => void
  handleResizeStart: (params: {
    e: React.MouseEvent
    elementId: string
    side: 'left' | 'right'
  }) => void
}) {
  return (
    <div
      className={`relative h-full cursor-pointer overflow-hidden rounded-[0.5rem] ${getTrackClasses(
        {
          type: track.type,
        },
      )} ${isBeingDragged ? 'z-30' : 'z-10'} ${canElementBeHidden(element) && element.hidden ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        className="absolute inset-0 size-full cursor-pointer"
        onClick={(e) => onElementClick(e, element)}
        onMouseDown={(e) => onElementMouseDown(e, element)}
      >
        <div className="absolute inset-0 flex h-full items-center">
          <ElementContent
            element={element}
            track={track}
            zoomLevel={zoomLevel}
            mediaAssets={mediaAssets}
          />
        </div>

        {canElementBeHidden(element) && element.hidden && (
          <div className="bg-opacity-50 pointer-events-none absolute inset-0 flex items-center justify-center bg-black">
            <EyeOff className="size-6 text-white" />
          </div>
        )}
        {hasAudio && isMuted && (
          <div className="pointer-events-none absolute right-1 bottom-1 flex items-center justify-center rounded bg-black/60 p-0.5">
            <VolumeX className="size-3.5 text-white" />
          </div>
        )}
      </button>

      {isSelected && (
        <>
          <div className="border-primary pointer-events-none absolute inset-0 z-20 rounded-[0.5rem] border-2" />
          <ResizeHandle
            side="left"
            elementId={element.id}
            handleResizeStart={handleResizeStart}
          />
          <ResizeHandle
            side="right"
            elementId={element.id}
            handleResizeStart={handleResizeStart}
          />
        </>
      )}
    </div>
  )
}

function ResizeHandle({
  side,
  elementId,
  handleResizeStart,
}: {
  side: 'left' | 'right'
  elementId: string
  handleResizeStart: (params: {
    e: React.MouseEvent
    elementId: string
    side: 'left' | 'right'
  }) => void
}) {
  const isLeft = side === 'left'
  return (
    <button
      type="button"
      className={`bg-primary absolute top-0 bottom-0 z-50 flex w-[0.6rem] items-center justify-center ${isLeft ? 'left-0 cursor-w-resize' : 'right-0 cursor-e-resize'}`}
      onMouseDown={(e) => handleResizeStart({ e, elementId, side })}
      aria-label={`${isLeft ? 'Left' : 'Right'} resize handle`}
    >
      <div className="bg-foreground h-[1.5rem] w-[0.2rem] rounded-full" />
    </button>
  )
}

function ElementContent({
  element,
  track,
  zoomLevel,
  mediaAssets,
}: {
  element: TimelineElementType
  track: TimelineTrack
  zoomLevel: number
  mediaAssets: MediaAsset[]
}) {
  if (element.type === 'text') {
    return (
      <div className="flex size-full items-center justify-start pl-2">
        <span className="truncate text-xs text-white">{element.content}</span>
      </div>
    )
  }

  if (element.type === 'sticker') {
    return (
      <div className="flex size-full items-center gap-2 pl-2">
        <Image
          src={`https://api.iconify.design/${element.iconName}.svg?width=20&height=20`}
          alt={element.name}
          className="size-5 shrink-0"
          width={20}
          height={20}
          unoptimized
        />
        <span className="truncate text-xs text-white">{element.name}</span>
      </div>
    )
  }

  if (element.type === 'audio') {
    const audioBuffer = element.buffer
    const audioBlob =
      element.sourceType === 'upload'
        ? mediaAssets.find((asset) => asset.id === element.mediaId)?.file
        : undefined

    const audioUrl =
      element.sourceType === 'library'
        ? element.sourceUrl
        : mediaAssets.find((asset) => asset.id === element.mediaId)?.url

    if (audioBuffer || audioUrl) {
      return (
        <div className="flex size-full items-center gap-2">
          <div className="min-w-0 flex-1">
            <AudioWaveform
              audioBuffer={audioBuffer}
              audioBlob={audioBlob}
              audioUrl={audioUrl}
              duration={element.duration}
              volume={element.volume}
              height={24}
              className="w-full"
            />
          </div>
        </div>
      )
    }

    return (
      <span className="text-foreground/80 truncate text-xs">
        {element.name}
      </span>
    )
  }

  const mediaAsset = mediaAssets.find((asset) => asset.id === element.mediaId)
  if (!mediaAsset) {
    return (
      <span className="text-foreground/80 truncate text-xs">
        {element.name}
      </span>
    )
  }

  if (mediaAsset.type === 'video' && mediaAsset.file) {
    const trackHeight = getTrackHeight({ type: track.type })
    const elementWidth =
      element.duration * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel

    return (
      <div className="relative size-full">
        <VideoThumbnailStrip
          mediaId={element.mediaId}
          file={mediaAsset.file}
          thumbnailUrl={mediaAsset.thumbnailUrl}
          trimStart={element.trimStart}
          duration={element.duration}
          elementWidth={elementWidth}
          trackHeight={trackHeight}
          zoomLevel={zoomLevel}
          fps={mediaAsset.fps ?? 30}
          mediaWidth={mediaAsset.width ?? 1920}
          mediaHeight={mediaAsset.height ?? 1080}
        />
      </div>
    )
  }

  if (mediaAsset.type === 'image' && mediaAsset.url) {
    return (
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${mediaAsset.url})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          pointerEvents: 'none',
        }}
      />
    )
  }

  return (
    <span className="text-foreground/80 truncate text-xs">{element.name}</span>
  )
}

function CopyMenuItem() {
  const t = useTranslations()
  return (
    <ActionMenuItem action="copy-selected" icon={<Copy className="size-4" />}>
      {t('common.copy')}
    </ActionMenuItem>
  )
}

function MuteMenuItem({
  isMultipleSelected,
  isCurrentElementSelected,
  isMuted,
}: {
  isMultipleSelected: boolean
  isCurrentElementSelected: boolean
  isMuted: boolean
}) {
  const getIcon = () => {
    if (isMultipleSelected && isCurrentElementSelected) {
      return <Volume1 className="size-4" />
    }
    return isMuted ? (
      <Volume2 className="size-4" />
    ) : (
      <VolumeX className="size-4" />
    )
  }

  const t = useTranslations()
  return (
    <ActionMenuItem action="toggle-elements-muted-selected" icon={getIcon()}>
      {isMuted ? t('common.unmute') : t('common.mute')}
    </ActionMenuItem>
  )
}

function VisibilityMenuItem({
  element,
  isMultipleSelected,
  isCurrentElementSelected,
}: {
  element: TimelineElementType
  isMultipleSelected: boolean
  isCurrentElementSelected: boolean
}) {
  const isHidden = canElementBeHidden(element) && element.hidden

  const getIcon = () => {
    if (isMultipleSelected && isCurrentElementSelected) {
      return <EyeOff className="size-4" />
    }
    return isHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />
  }

  const t = useTranslations()
  return (
    <ActionMenuItem
      action="toggle-elements-visibility-selected"
      icon={getIcon()}
    >
      {isHidden ? t('common.show') : t('common.hide')}
    </ActionMenuItem>
  )
}

function DeleteMenuItem({
  isMultipleSelected,
  isCurrentElementSelected,
  elementType,
  selectedCount,
}: {
  isMultipleSelected: boolean
  isCurrentElementSelected: boolean
  elementType: TimelineElementType['type']
  selectedCount: number
}) {
  const t = useTranslations()
  return (
    <ActionMenuItem
      action="delete-selected"
      variant="destructive"
      icon={<Trash2 className="size-4" />}
    >
      {isMultipleSelected && isCurrentElementSelected
        ? t('projects.deleteElements', { count: selectedCount })
        : t('timeline.deleteType', {
            type:
              elementType === 'text'
                ? t('common.textLower')
                : t('timeline.clip'),
          })}
    </ActionMenuItem>
  )
}

function VideoEditSubmenu({
  element,
  trackId,
}: {
  element: VideoElement
  trackId: string
}) {
  const t = useTranslations()
  const editor = useEditor()

  const isMirrored = element.transform.flipX === true
  const isReversed = element.reversed === true

  const toggleMirror = (event: React.MouseEvent) => {
    event.stopPropagation()
    editor.timeline.updateElements({
      updates: [
        {
          trackId,
          elementId: element.id,
          updates: {
            transform: {
              ...element.transform,
              flipX: !isMirrored,
            },
          },
        },
      ],
    })
  }

  const toggleReverse = (event: React.MouseEvent) => {
    event.stopPropagation()
    editor.timeline.updateElements({
      updates: [
        {
          trackId,
          elementId: element.id,
          updates: { reversed: !isReversed },
        },
      ],
    })
  }

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <Pencil className="size-4" />
        {t('editor.basicEdit')}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-48">
        <ContextMenuCheckboxItem
          className="px-4"
          checked={isMirrored}
          onClick={toggleMirror}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              toggleMirror(event as unknown as React.MouseEvent)
            }
          }}
        >
          <FlipHorizontal className="size-4" />
          {t('properties.mirror')}
        </ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem
          className="px-4"
          checked={isReversed}
          onClick={toggleReverse}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              toggleReverse(event as unknown as React.MouseEvent)
            }
          }}
        >
          <Undo2 className="size-4" />
          {t('common.reverse')}
        </ContextMenuCheckboxItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
  )
}

function ActionMenuItem({
  action,
  icon,
  children,
  ...props
}: Omit<ComponentProps<typeof ContextMenuItem>, 'onClick'> & {
  action: TAction
  icon?: React.ReactNode
}) {
  const shortcut = getDisplayShortcut(action)
  return (
    <ContextMenuItem
      onClick={(event) => {
        event.stopPropagation()
        invokeAction(action)
      }}
      {...props}
    >
      {icon}
      {children}
      {shortcut && <ContextMenuShortcut>{shortcut}</ContextMenuShortcut>}
    </ContextMenuItem>
  )
}
