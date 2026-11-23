'use client'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@cdlab/ui/components/context-menu'
import { ScrollArea, ScrollBar } from '@cdlab/ui/components/scroll-area'
import { cn } from '@cdlab/ui/lib/utils'
import type { LucideIcon } from 'lucide-react'
import {
  ClipboardPaste,
  Eye,
  EyeOff,
  GripVertical,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useRef, useState } from 'react'
import { IS_DEV } from '@/constants/editor-constants'
import { TIMELINE_CONSTANTS, TRACK_ICONS } from '@/constants/timeline-constants'
import { useElementInteraction } from '@/hooks/timeline/element/use-element-interaction'
import { useElementSelection } from '@/hooks/timeline/element/use-element-selection'
import { useScrollSync } from '@/hooks/timeline/use-scroll-sync'
import { useSelectionBox } from '@/hooks/timeline/use-selection-box'
import { useTimelineDragDrop } from '@/hooks/timeline/use-timeline-drag-drop'
import { useTimelinePlayhead } from '@/hooks/timeline/use-timeline-playhead'
import { useTimelineSeek } from '@/hooks/timeline/use-timeline-seek'
import type { SnapPoint } from '@/hooks/timeline/use-timeline-snapping'
import { useTimelineZoom } from '@/hooks/timeline/use-timeline-zoom'
import { useTrackReorder } from '@/hooks/timeline/use-track-reorder'
import { useEditor } from '@/hooks/use-editor'
import { invokeAction } from '@/lib/actions'
import {
  canTrackBeHidden,
  canTracktHaveAudio,
  getCumulativeHeightBefore,
  getTimelinePaddingPx,
  getTimelineZoomMin,
  getTotalTracksHeight,
  getTrackHeight,
  getZoomToFit,
  isMainTrack,
} from '@/lib/timeline'
import { useTimelineStore } from '@/stores/timeline-store'
import type { TimelineTrack } from '@/types/timeline'
import { SelectionBox } from '../../selection-box'
import { TimelineBookmarksRow } from './bookmarks'
import { DragLine } from './drag-line'
import { SnapIndicator } from './snap-indicator'
import { TimelinePlayhead } from './timeline-playhead'
import { TimelineRuler } from './timeline-ruler'
import { TimelineToolbar } from './timeline-toolbar'
import { TimelineTrackContent } from './timeline-track'

export function Timeline() {
  const t = useTranslations()
  const tracksContainerHeight = { min: 0, max: 800 }
  const { snappingEnabled } = useTimelineStore()
  const { clearElementSelection, setElementSelection } = useElementSelection()
  const editor = useEditor()
  const timeline = editor.timeline
  const tracks = timeline.getTracks()
  const seek = (time: number) => editor.playback.seek({ time })

  // refs
  const timelineRef = useRef<HTMLDivElement>(null)
  const timelineHeaderRef = useRef<HTMLDivElement>(null)
  const rulerRef = useRef<HTMLDivElement>(null)
  const tracksContainerRef = useRef<HTMLDivElement>(null)
  const tracksScrollRef = useRef<HTMLDivElement>(null)
  const trackLabelsRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const trackLabelsScrollRef = useRef<HTMLDivElement>(null)

  // state
  const [isResizing, setIsResizing] = useState(false)
  const [currentSnapPoint, setCurrentSnapPoint] = useState<SnapPoint | null>(
    null,
  )

  const handleSnapPointChange = useCallback((snapPoint: SnapPoint | null) => {
    setCurrentSnapPoint(snapPoint)
  }, [])
  const handleResizeStateChange = useCallback(
    ({ isResizing: nextIsResizing }: { isResizing: boolean }) => {
      setIsResizing(nextIsResizing)
      if (!nextIsResizing) {
        setCurrentSnapPoint(null)
      }
    },
    [],
  )

  const timelineDuration = timeline.getTotalDuration() || 0
  const minZoomLevel = getTimelineZoomMin({
    duration: timelineDuration,
    containerWidth: tracksContainerRef.current?.clientWidth,
  })

  const savedViewState = editor.project.getTimelineViewState()

  const { zoomLevel, setZoomLevel, handleWheel, saveScrollPosition } =
    useTimelineZoom({
      containerRef: timelineRef,
      minZoom: minZoomLevel,
      initialZoom: savedViewState?.zoomLevel,
      initialScrollLeft: savedViewState?.scrollLeft,
      initialPlayheadTime: savedViewState?.playheadTime,
      tracksScrollRef,
      rulerScrollRef: tracksScrollRef,
    })

  const {
    dragState,
    dragDropTarget,
    handleElementMouseDown,
    handleElementClick,
    lastMouseXRef,
  } = useElementInteraction({
    zoomLevel,
    timelineRef,
    tracksContainerRef,
    tracksScrollRef,
    headerRef: timelineHeaderRef,
    snappingEnabled,
    onSnapPointChange: handleSnapPointChange,
  })

  const { handleRulerMouseDown: handlePlayheadRulerMouseDown } =
    useTimelinePlayhead({
      zoomLevel,
      rulerRef,
      rulerScrollRef: tracksScrollRef,
      tracksScrollRef,
      playheadRef,
    })

  const { isDragOver, dropTarget, dragProps } = useTimelineDragDrop({
    containerRef: tracksContainerRef,
    headerRef: timelineHeaderRef,
    zoomLevel,
  })

  const {
    selectionBox,
    handleMouseDown: handleSelectionMouseDown,
    isSelecting,
    shouldIgnoreClick,
  } = useSelectionBox({
    containerRef: tracksContainerRef,
    onSelectionComplete: (elements) => {
      setElementSelection({ elements })
    },
    tracksScrollRef,
    zoomLevel,
    headerRef: timelineHeaderRef,
  })

  const containerWidth = tracksContainerRef.current?.clientWidth || 1000
  const contentWidth =
    timelineDuration * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel
  const paddingPx = getTimelinePaddingPx({
    containerWidth,
    zoomLevel,
    minZoom: minZoomLevel,
  })
  const dynamicTimelineWidth = Math.max(
    contentWidth + paddingPx,
    containerWidth,
  )

  const showSnapIndicator =
    snappingEnabled &&
    currentSnapPoint !== null &&
    (dragState.isDragging || isResizing)

  const {
    handleTracksMouseDown,
    handleTracksClick,
    handleRulerMouseDown,
    handleRulerClick,
  } = useTimelineSeek({
    playheadRef,
    trackLabelsRef,
    rulerScrollRef: tracksScrollRef,
    tracksScrollRef,
    zoomLevel,
    duration: timeline.getTotalDuration(),
    isSelecting,
    clearSelectedElements: clearElementSelection,
    seek,
  })

  useScrollSync({
    tracksScrollRef,
    trackLabelsScrollRef,
  })

  const { reorderState, handleTrackDragStart } = useTrackReorder()

  const timelineHeaderHeight =
    timelineHeaderRef.current?.getBoundingClientRect().height ?? 0

  return (
    <section
      className={
        'panel bg-background relative flex h-full flex-col overflow-hidden rounded-sm border'
      }
      {...dragProps}
      aria-label="Timeline"
    >
      <TimelineToolbar
        zoomLevel={zoomLevel}
        minZoom={minZoomLevel}
        zoomToFitLevel={getZoomToFit({
          duration: timelineDuration,
          containerWidth: tracksContainerRef.current?.clientWidth,
        })}
        setZoomLevel={({ zoom }) => setZoomLevel(zoom)}
      />

      <div
        className="relative flex flex-1 flex-col overflow-hidden"
        ref={timelineRef}
      >
        <SnapIndicator
          snapPoint={currentSnapPoint}
          zoomLevel={zoomLevel}
          tracks={tracks}
          timelineRef={timelineRef}
          trackLabelsRef={trackLabelsRef}
          tracksScrollRef={tracksScrollRef}
          isVisible={showSnapIndicator}
        />
        <div className="flex flex-1 overflow-hidden">
          <div className="bg-background flex w-28 shrink-0 flex-col border-r">
            <div className="bg-background flex h-4 items-center justify-between px-3">
              <span className="opacity-0">.</span>
            </div>
            <div className="bg-background flex h-4 items-center justify-between px-3">
              <span className="opacity-0">.</span>
            </div>
            {tracks.length > 0 && (
              <div
                ref={trackLabelsRef}
                className="bg-background flex-1 overflow-y-auto"
                style={{ paddingTop: TIMELINE_CONSTANTS.PADDING_TOP_PX }}
              >
                <ScrollArea
                  className="size-full overflow-y-hidden"
                  ref={trackLabelsScrollRef}
                >
                  <div className="flex flex-col gap-1">
                    {tracks.map((track, index) => {
                      const isDragTarget =
                        reorderState.isDragging &&
                        reorderState.dragOverIndex === index &&
                        reorderState.dragTrackId !== track.id
                      const isBeingDragged =
                        reorderState.isDragging &&
                        reorderState.dragTrackId === track.id

                      return (
                        <div
                          key={track.id}
                          className={cn(
                            'group flex items-center px-1',
                            isBeingDragged && 'opacity-40',
                            isDragTarget && 'border-primary border-t-2',
                          )}
                          style={{
                            height: `${getTrackHeight({ type: track.type })}px`,
                          }}
                        >
                          <GripVertical
                            className="text-muted-foreground/50 group-hover:text-muted-foreground size-3.5 shrink-0 cursor-grab active:cursor-grabbing"
                            onMouseDown={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              if (trackLabelsRef.current) {
                                handleTrackDragStart({
                                  trackId: track.id,
                                  mouseY: event.clientY,
                                  container: trackLabelsRef.current,
                                })
                              }
                            }}
                          />
                          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                            {IS_DEV && isMainTrack(track) && (
                              <div className="bg-red-500 size-1.5 rounded-full" />
                            )}
                            {canTracktHaveAudio(track) && (
                              <TrackToggleIcon
                                isOff={track.muted}
                                icons={{
                                  on: Volume2,
                                  off: VolumeX,
                                }}
                                onClick={() =>
                                  editor.timeline.toggleTrackMute({
                                    trackId: track.id,
                                  })
                                }
                              />
                            )}
                            {canTrackBeHidden(track) && (
                              <TrackToggleIcon
                                isOff={track.hidden}
                                icons={{
                                  on: Eye,
                                  off: EyeOff,
                                }}
                                onClick={() =>
                                  editor.timeline.toggleTrackVisibility({
                                    trackId: track.id,
                                  })
                                }
                              />
                            )}
                            <TrackIcon track={track} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <div
            className="relative flex flex-1 flex-col overflow-hidden"
            ref={tracksContainerRef}
          >
            <SelectionBox
              startPos={selectionBox?.startPos || null}
              currentPos={selectionBox?.currentPos || null}
              containerRef={tracksContainerRef}
              isActive={selectionBox?.isActive || false}
            />
            <DragLine
              dropTarget={dropTarget}
              tracks={timeline.getTracks()}
              isVisible={isDragOver}
              headerHeight={timelineHeaderHeight}
            />
            <DragLine
              dropTarget={dragDropTarget}
              tracks={timeline.getTracks()}
              isVisible={dragState.isDragging}
              headerHeight={timelineHeaderHeight}
            />
            <TimelinePlayhead
              zoomLevel={zoomLevel}
              rulerRef={rulerRef}
              rulerScrollRef={tracksScrollRef}
              tracksScrollRef={tracksScrollRef}
              containerRef={tracksContainerRef}
              playheadRef={playheadRef}
              isSnappingToPlayhead={
                showSnapIndicator && currentSnapPoint?.type === 'playhead'
              }
            />
            <ScrollArea
              className="size-full"
              ref={tracksScrollRef}
              onMouseDown={(event) => {
                const isDirectTarget = event.target === event.currentTarget
                if (!isDirectTarget) return
                event.stopPropagation()
                handleTracksMouseDown(event)
                handleSelectionMouseDown(event)
              }}
              onClick={(event) => {
                const isDirectTarget = event.target === event.currentTarget
                if (!isDirectTarget) return
                event.stopPropagation()
                handleTracksClick(event)
              }}
              onWheel={(event) => {
                if (
                  event.shiftKey ||
                  Math.abs(event.deltaX) > Math.abs(event.deltaY)
                ) {
                  return
                }
                handleWheel(event)
              }}
              onScroll={() => {
                saveScrollPosition()
              }}
            >
              <div
                className="relative"
                style={{
                  width: `${dynamicTimelineWidth}px`,
                }}
              >
                <div
                  ref={timelineHeaderRef}
                  className="bg-background sticky top-0 z-30 flex flex-col"
                >
                  <TimelineRuler
                    zoomLevel={zoomLevel}
                    dynamicTimelineWidth={dynamicTimelineWidth}
                    rulerRef={rulerRef}
                    tracksScrollRef={tracksScrollRef}
                    handleWheel={handleWheel}
                    handleTimelineContentClick={handleRulerClick}
                    handleRulerTrackingMouseDown={handleRulerMouseDown}
                    handleRulerMouseDown={handlePlayheadRulerMouseDown}
                  />
                  <TimelineBookmarksRow
                    zoomLevel={zoomLevel}
                    dynamicTimelineWidth={dynamicTimelineWidth}
                    handleWheel={handleWheel}
                    handleTimelineContentClick={handleRulerClick}
                    handleRulerTrackingMouseDown={handleRulerMouseDown}
                    handleRulerMouseDown={handlePlayheadRulerMouseDown}
                  />
                </div>
                <div
                  className="relative"
                  style={{
                    height: `${Math.max(
                      tracksContainerHeight.min,
                      Math.min(
                        tracksContainerHeight.max,
                        getTotalTracksHeight({ tracks }),
                      ),
                    )}px`,
                  }}
                >
                  {tracks.length === 0 ? (
                    <div />
                  ) : (
                    tracks.map((track, index) => {
                      const isBeingDragged =
                        reorderState.isDragging &&
                        reorderState.dragTrackId === track.id

                      return (
                        <ContextMenu key={track.id}>
                          <ContextMenuTrigger
                            render={
                              <div
                                className={cn(
                                  'absolute right-0 left-0',
                                  isBeingDragged && 'opacity-40',
                                )}
                                style={{
                                  top: `${getCumulativeHeightBefore({
                                    tracks,
                                    trackIndex: index,
                                  })}px`,
                                  height: `${getTrackHeight({
                                    type: track.type,
                                  })}px`,
                                }}
                              />
                            }
                          >
                            <TimelineTrackContent
                              track={track}
                              zoomLevel={zoomLevel}
                              dragState={dragState}
                              rulerScrollRef={tracksScrollRef}
                              tracksScrollRef={tracksScrollRef}
                              lastMouseXRef={lastMouseXRef}
                              onSnapPointChange={handleSnapPointChange}
                              onResizeStateChange={handleResizeStateChange}
                              onElementMouseDown={handleElementMouseDown}
                              onElementClick={handleElementClick}
                              onTrackMouseDown={(event) => {
                                handleSelectionMouseDown(event)
                                handleTracksMouseDown(event)
                              }}
                              onTrackClick={handleTracksClick}
                              shouldIgnoreClick={shouldIgnoreClick}
                            />
                          </ContextMenuTrigger>
                          <ContextMenuContent className="z-200 w-40">
                            <ContextMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                invokeAction('paste-copied')
                              }}
                            >
                              <ClipboardPaste className="size-4" />
                              {t('timeline.pasteElements')}
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                timeline.toggleTrackMute({
                                  trackId: track.id,
                                })
                              }}
                            >
                              <Volume2 className="size-4" />
                              <span>
                                {canTracktHaveAudio(track) && track.muted
                                  ? t('timeline.unmuteTrack')
                                  : t('timeline.muteTrack')}
                              </span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                timeline.toggleTrackVisibility({
                                  trackId: track.id,
                                })
                              }}
                            >
                              <Eye className="size-4" />
                              <span>
                                {canTrackBeHidden(track) && track.hidden
                                  ? t('timeline.showTrack')
                                  : t('timeline.hideTrack')}
                              </span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                timeline.removeTrack({
                                  trackId: track.id,
                                })
                              }}
                              variant="destructive"
                              disabled={isMainTrack(track)}
                            >
                              <Trash2 className="size-4" />
                              {t('timeline.deleteTrack')}
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      )
                    })
                  )}
                </div>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </div>
      </div>
    </section>
  )
}

function TrackIcon({ track }: { track: TimelineTrack }) {
  return <>{TRACK_ICONS[track.type]}</>
}

function TrackToggleIcon({
  isOff,
  icons,
  onClick,
}: {
  isOff: boolean
  icons: {
    on: LucideIcon
    off: LucideIcon
  }
  onClick: () => void
}) {
  const Icon = isOff ? icons.off : icons.on
  return (
    <Icon
      className={cn(
        'size-4 cursor-pointer',
        isOff ? 'text-destructive' : 'text-muted-foreground',
      )}
      onClick={onClick}
    />
  )
}
