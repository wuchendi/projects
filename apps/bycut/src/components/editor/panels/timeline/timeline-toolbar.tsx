'use client'

import { Button } from '@cdlab/ui/components/button'
import { ScrollArea } from '@cdlab/ui/components/scroll-area'
import { Separator } from '@cdlab/ui/components/separator'
import { Slider } from '@cdlab/ui/components/slider'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@cdlab/ui/components/tooltip'
import { cn } from '@cdlab/ui/lib/utils'
import {
  AlignEndHorizontal,
  AlignStartHorizontal,
  Bookmark,
  BookmarkMinus,
  BookmarkX,
  Copy,
  Link,
  Magnet,
  Maximize2,
  Redo2,
  Scissors,
  Snowflake,
  SplitSquareHorizontal,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { TIMELINE_CONSTANTS } from '@/constants/timeline-constants'
import { useEditor } from '@/hooks/use-editor'
import type { TAction } from '@/lib/actions'
import { invokeAction } from '@/lib/actions'
import { sliderToZoom, zoomToSlider } from '@/lib/timeline/zoom-utils'
import { useTimelineStore } from '@/stores/timeline-store'
import { firstSliderValue } from '@/utils/slider'

export function TimelineToolbar({
  zoomLevel,
  minZoom,
  zoomToFitLevel,
  setZoomLevel,
}: {
  zoomLevel: number
  minZoom: number
  zoomToFitLevel: number
  setZoomLevel: ({ zoom }: { zoom: number }) => void
}) {
  const handleZoom = ({ direction }: { direction: 'in' | 'out' }) => {
    const newZoomLevel =
      direction === 'in'
        ? Math.min(
            TIMELINE_CONSTANTS.ZOOM_MAX,
            zoomLevel * TIMELINE_CONSTANTS.ZOOM_BUTTON_FACTOR,
          )
        : Math.max(minZoom, zoomLevel / TIMELINE_CONSTANTS.ZOOM_BUTTON_FACTOR)
    setZoomLevel({ zoom: newZoomLevel })
  }

  return (
    <ScrollArea className="scrollbar-hidden">
      <div className="flex h-10 items-center justify-between border-b px-2 py-1">
        <ToolbarLeftSection />

        <ToolbarRightSection
          zoomLevel={zoomLevel}
          minZoom={minZoom}
          onZoomChange={(zoom) => setZoomLevel({ zoom })}
          onZoom={handleZoom}
          onZoomToFit={() => setZoomLevel({ zoom: zoomToFitLevel })}
        />
      </div>
    </ScrollArea>
  )
}

function ToolbarLeftSection() {
  const t = useTranslations()
  const editor = useEditor()
  const handleAction = ({
    action,
    event,
  }: {
    action: TAction
    event: React.MouseEvent
  }) => {
    event.stopPropagation()
    invokeAction(action)
  }

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider delay={500}>
        <ToolbarButton
          icon={<Scissors />}
          tooltip={t('timeline.splitElement')}
          onClick={({ event }) => handleAction({ action: 'split', event })}
        />

        <ToolbarButton
          icon={<AlignStartHorizontal />}
          tooltip={t('timeline.splitLeft')}
          onClick={({ event }) => handleAction({ action: 'split-left', event })}
        />

        <ToolbarButton
          icon={<AlignEndHorizontal />}
          tooltip={t('timeline.splitRight')}
          onClick={({ event }) =>
            handleAction({ action: 'split-right', event })
          }
        />

        <ToolbarButton
          icon={<SplitSquareHorizontal />}
          tooltip={t('common.comingSoon')}
          disabled={true}
          onClick={({ event: _event }) => {}}
        />

        <ToolbarButton
          icon={<Copy />}
          tooltip={t('timeline.duplicateElement')}
          onClick={({ event }) =>
            handleAction({ action: 'duplicate-selected', event })
          }
        />

        <ToolbarButton
          icon={<Snowflake />}
          tooltip={t('common.comingSoon')}
          disabled={true}
          onClick={({ event: _event }) => {}}
        />

        <ToolbarButton
          icon={<Trash2 />}
          tooltip={t('timeline.deleteElement')}
          onClick={({ event }) =>
            handleAction({ action: 'delete-selected', event })
          }
        />

        <Separator orientation="vertical" className="m-2" />

        <ToolbarButton
          icon={<Undo2 />}
          tooltip={t('shortcuts.actions.undo')}
          disabled={!editor.command.canUndo()}
          onClick={({ event }) => handleAction({ action: 'undo', event })}
        />

        <ToolbarButton
          icon={<Redo2 />}
          tooltip={t('shortcuts.actions.redo')}
          disabled={!editor.command.canRedo()}
          onClick={({ event }) => handleAction({ action: 'redo', event })}
        />
      </TooltipProvider>
    </div>
  )
}

function ToolbarRightSection({
  zoomLevel,
  minZoom,
  onZoomChange,
  onZoom,
  onZoomToFit,
}: {
  zoomLevel: number
  minZoom: number
  onZoomChange: (zoom: number) => void
  onZoom: (options: { direction: 'in' | 'out' }) => void
  onZoomToFit: () => void
}) {
  const t = useTranslations()
  const editor = useEditor()
  const currentTime = editor.playback.getCurrentTime()
  const currentBookmarked = editor.scenes.isBookmarked({ time: currentTime })
  const activeScene = editor.scenes.getActiveScene()
  const hasBookmarks = activeScene.bookmarks.length > 0
  const {
    snappingEnabled,
    rippleEditingEnabled,
    toggleSnapping,
    toggleRippleEditing,
  } = useTimelineStore()

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider delay={500}>
        <ToolbarButton
          icon={<Bookmark />}
          tooltip={t('timeline.addBookmark')}
          disabled={currentBookmarked}
          onClick={() => invokeAction('add-bookmark')}
        />

        <ToolbarButton
          icon={<BookmarkMinus />}
          tooltip={t('timeline.removeBookmark')}
          disabled={!currentBookmarked}
          onClick={() => invokeAction('remove-bookmark')}
        />

        <ToolbarButton
          icon={<BookmarkX />}
          tooltip={t('timeline.removeAllBookmarks')}
          disabled={!hasBookmarks}
          onClick={() => invokeAction('clear-all-bookmarks')}
        />
      </TooltipProvider>

      <Separator orientation="vertical" className="m-2" />

      <TooltipProvider delay={500}>
        <ToolbarButton
          icon={<Magnet />}
          isActive={snappingEnabled}
          tooltip={t('timeline.autoSnapping')}
          onClick={() => toggleSnapping()}
        />

        <ToolbarButton
          icon={<Link className="scale-110" />}
          isActive={rippleEditingEnabled}
          tooltip={t('timeline.rippleEditing')}
          onClick={() => toggleRippleEditing()}
        />
      </TooltipProvider>

      <Separator orientation="vertical" className="m-2" />

      <div className="flex items-center gap-1">
        <TooltipProvider delay={500}>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onZoom({ direction: 'out' })}
                />
              }
            >
              <ZoomOut />
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{t('timeline.zoomOut')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Slider
          className="w-24"
          value={[zoomToSlider({ zoomLevel, minZoom })]}
          onValueChange={(values) =>
            onZoomChange(
              sliderToZoom({
                sliderPosition: firstSliderValue(values),
                minZoom,
              }),
            )
          }
          min={0}
          max={1}
          step={0.005}
        />
        <TooltipProvider delay={500}>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onZoom({ direction: 'in' })}
                />
              }
            >
              <ZoomIn />
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{t('timeline.zoomIn')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider delay={500}>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon" onClick={onZoomToFit} />
              }
            >
              <Maximize2 />
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{t('timeline.zoomToFit')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">
          {Math.max(1, Math.round(zoomToSlider({ zoomLevel, minZoom }) * 100))}%
        </span>
      </div>
    </div>
  )
}

function ToolbarButton({
  icon,
  tooltip,
  onClick,
  disabled,
  isActive,
}: {
  icon: React.ReactNode
  tooltip: string
  onClick: ({ event }: { event: React.MouseEvent }) => void
  disabled?: boolean
  isActive?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={200}
        render={
          <Button
            variant={isActive ? 'secondary' : 'ghost'}
            size="icon"
            type="button"
            onClick={(event) => onClick({ event })}
            className={cn(
              'rounded-sm',
              disabled ? 'cursor-not-allowed opacity-50' : '',
            )}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
