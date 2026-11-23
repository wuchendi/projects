'use client'

import { AspectRatio } from '@cdlab/ui/components/aspect-ratio'
import { Button } from '@cdlab/ui/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@cdlab/ui/components/tooltip'
import { cn } from '@cdlab/ui/lib/utils'
import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditor } from '@/hooks/use-editor'
import { clearDragData, setDragData } from '@/lib/drag-data'
import type { TimelineDragData } from '@/types/drag'

export interface DraggableItemProps {
  name: string
  preview: ReactNode
  dragData: TimelineDragData
  onDragStart?: ({ e }: { e: React.DragEvent }) => void
  onAddToTimeline?: ({ currentTime }: { currentTime: number }) => void
  onClick?: () => void
  aspectRatio?: number
  className?: string
  containerClassName?: string
  shouldShowPlusOnDrag?: boolean
  shouldShowLabel?: boolean
  isRounded?: boolean
  variant?: 'card' | 'compact'
  isDraggable?: boolean
  isHighlighted?: boolean
  isSelected?: boolean
}

export function DraggableItem({
  name,
  preview,
  dragData,
  onDragStart,
  onAddToTimeline,
  onClick,
  aspectRatio = 16 / 9,
  className = '',
  containerClassName,
  shouldShowPlusOnDrag = true,
  shouldShowLabel = true,
  isRounded = true,
  variant = 'card',
  isDraggable = true,
  isHighlighted = false,
  isSelected = false,
}: DraggableItemProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 })
  const dragRef = useRef<HTMLDivElement>(null)
  const didDragRef = useRef(false)
  const editor = useEditor()
  const highlightClassName = `ring-2 ring-primary bg-primary/10 ${isRounded ? 'rounded-sm' : ''}`
  const selectedClassName = `ring-2 ring-primary ${isRounded ? 'rounded-sm' : ''}`

  const handleAddToTimeline = () => {
    onAddToTimeline?.({ currentTime: editor.playback.getCurrentTime() })
  }

  const emptyImg = new window.Image()
  emptyImg.src =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs='

  useEffect(() => {
    if (!isDragging) return

    const handleDragOver = (e: DragEvent) => {
      setDragPosition({ x: e.clientX, y: e.clientY })
    }

    document.addEventListener('dragover', handleDragOver)

    return () => {
      document.removeEventListener('dragover', handleDragOver)
    }
  }, [isDragging])

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setDragImage(emptyImg, 0, 0)

    setDragData({ dataTransfer: e.dataTransfer, dragData })
    e.dataTransfer.effectAllowed = 'copy'

    setDragPosition({ x: e.clientX, y: e.clientY })
    setIsDragging(true)
    didDragRef.current = true

    onDragStart?.({ e })
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    clearDragData()
  }

  const handleClick = () => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    onClick?.()
  }

  return (
    <>
      {variant === 'card' ? (
        <div
          ref={dragRef}
          className={cn('group relative', containerClassName ?? 'size-28')}
          onClick={handleClick}
          onKeyUp={(event) => {
            if (event.key === 'Enter') handleClick()
          }}
          role="button"
          tabIndex={0}
        >
          <div
            className={cn(
              'relative flex h-auto w-full cursor-default flex-col gap-1 p-1',
              className,
              isHighlighted && highlightClassName,
              isSelected && selectedClassName,
            )}
          >
            <AspectRatio
              ratio={aspectRatio}
              className={cn(
                'bg-accent relative overflow-hidden',
                isRounded && 'rounded-sm',
                isDraggable && '[&::-webkit-drag-ghost]:opacity-0',
              )}
              draggable={isDraggable}
              onDragStart={isDraggable ? handleDragStart : undefined}
              onDragEnd={isDraggable ? handleDragEnd : undefined}
            >
              {preview}
              {!isDragging && (
                <PlusButton
                  className="opacity-0 group-hover:opacity-100"
                  onClick={handleAddToTimeline}
                />
              )}
            </AspectRatio>
            {shouldShowLabel && (
              <span
                className="text-muted-foreground w-full truncate text-left text-[0.7rem]"
                title={name}
              >
                <span className="sr-only">{name}</span>
                <span aria-hidden="true">
                  {name.length > 8
                    ? `${name.slice(0, 16)}...${name.slice(-3)}`
                    : name}
                </span>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          ref={dragRef}
          className={cn(
            'group relative w-full min-w-0',
            isHighlighted && highlightClassName,
            isSelected && selectedClassName,
          )}
        >
          <div
            className={cn(
              'flex w-full cursor-default items-center rounded-md px-1 py-1.5 transition-colors hover:bg-accent/50',
              isDraggable && '[&::-webkit-drag-ghost]:opacity-0',
              className,
            )}
            draggable={isDraggable}
            onDragStart={isDraggable ? handleDragStart : undefined}
            onDragEnd={isDraggable ? handleDragEnd : undefined}
            onClick={handleClick}
          >
            {preview}
          </div>
        </div>
      )}

      {isDraggable &&
        isDragging &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="pointer-events-none fixed z-9999"
            style={{
              left: dragPosition.x - 40,
              top: dragPosition.y - 40,
            }}
          >
            <div className="w-[80px]">
              <AspectRatio
                ratio={1}
                className="ring-primary relative overflow-hidden rounded-md shadow-2xl ring-3"
              >
                <div className="size-full [&_img]:size-full [&_img]:rounded-none [&_img]:object-cover">
                  {preview}
                </div>
                {shouldShowPlusOnDrag && (
                  <PlusButton
                    onClick={handleAddToTimeline}
                    tooltipText="Add to timeline or drag to position"
                  />
                )}
              </AspectRatio>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function PlusButton({
  className,
  onClick,
  tooltipText,
}: {
  className?: string
  onClick?: () => void
  tooltipText?: string
}) {
  const button = (
    <Button
      size="icon"
      className={cn(
        'bg-background hover:bg-background text-foreground absolute right-2 bottom-2 size-5',
        className,
      )}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick?.()
      }}
      title={tooltipText}
    >
      <Plus />
    </Button>
  )

  if (tooltipText) {
    return (
      <Tooltip>
        <TooltipTrigger render={button} />
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return button
}
