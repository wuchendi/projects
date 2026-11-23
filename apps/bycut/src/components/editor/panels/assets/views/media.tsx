'use client'

import { Button } from '@cdlab/ui/components/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@cdlab/ui/components/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@cdlab/ui/components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@cdlab/ui/components/dropdown-menu'
import { Input } from '@cdlab/ui/components/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '@cdlab/ui/components/input-group'
import { ScrollArea } from '@cdlab/ui/components/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@cdlab/ui/components/tooltip'
import { cn } from '@cdlab/ui/lib/utils'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowUpDown,
  CloudUpload,
  Filter,
  Image as ImageIcon,
  LayoutGrid,
  Link,
  List,
  Monitor,
  Music,
  Search,
  Video,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MediaDragOverlay } from '@/components/editor/panels/assets/drag-overlay'
import { DraggableItem } from '@/components/editor/panels/assets/draggable-item'
import { MediaInfoPanel } from '@/components/editor/panels/assets/views/media-info-panel'
import { TIMELINE_CONSTANTS } from '@/constants/timeline-constants'
import { useEditor } from '@/hooks/use-editor'
import { useFileUpload } from '@/hooks/use-file-upload'
import { useRevealItem } from '@/hooks/use-reveal-item'
import { processMediaAssets } from '@/lib/media/processing'
import { fetchRemoteMediaAsFile } from '@/lib/media/url-import'
import {
  buildImageElement,
  buildUploadAudioElement,
  buildVideoElement,
} from '@/lib/timeline/element-utils'
import { useAssetsPanelStore } from '@/stores/assets-panel-store'
import { useMediaPreviewStore } from '@/stores/media-preview-store'
import type { MediaAsset } from '@/types/assets'
import type { CreateTimelineElement } from '@/types/timeline'

export function MediaView() {
  const t = useTranslations()
  const editor = useEditor()
  const mediaFiles = editor.media.getAssets()
  const activeProject = editor.project.getActive()

  const { mediaViewMode, setMediaViewMode, highlightMediaId, clearHighlight } =
    useAssetsPanelStore()
  const { highlightedId, registerElement } = useRevealItem(
    highlightMediaId,
    clearHighlight,
  )

  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'duration' | 'size'>(
    'name',
  )
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<
    'all' | 'video' | 'audio' | 'image'
  >('all')

  const [isUrlDialogOpen, setIsUrlDialogOpen] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [isUrlImporting, setIsUrlImporting] = useState(false)

  const processFiles = async ({ files }: { files: FileList | File[] }) => {
    if (!files || files.length === 0) return
    if (!activeProject) {
      toast.error(t('editor.noActiveProject'))
      return
    }

    setIsProcessing(true)
    setProgress(0)
    try {
      const processedAssets = await processMediaAssets({
        files,
        onProgress: (progress: { progress: number }) =>
          setProgress(progress.progress),
      })
      for (const asset of processedAssets) {
        await editor.media.addMediaAsset({
          projectId: activeProject.metadata.id,
          asset,
        })
      }
    } catch (error) {
      console.error('Error processing files:', error)
      toast.error(t('media.processFailed'))
    } finally {
      setIsProcessing(false)
      setProgress(0)
    }
  }

  const handleUrlImport = async () => {
    const trimmedUrl = urlInput.trim()
    if (!trimmedUrl) return

    try {
      new URL(trimmedUrl)
    } catch {
      toast.error(t('media.invalidUrl'))
      return
    }

    setIsUrlImporting(true)
    try {
      const file = await fetchRemoteMediaAsFile({ url: trimmedUrl })
      await processFiles({ files: [file] })
      setIsUrlDialogOpen(false)
      setUrlInput('')
      toast.success(t('media.importSuccess'))
    } catch (error) {
      console.error('Error importing from URL:', error)
      toast.error(
        error instanceof Error ? error.message : t('media.importFailed'),
      )
    } finally {
      setIsUrlImporting(false)
    }
  }

  const { isDragOver, dragProps, openFilePicker, fileInputProps } =
    useFileUpload({
      accept: 'image/*,video/*,audio/*',
      multiple: true,
      onFilesSelected: (files) => processFiles({ files }),
    })

  const handleRemove = async ({
    event,
    id,
  }: {
    event: React.MouseEvent
    id: string
  }) => {
    event.stopPropagation()

    if (!activeProject) {
      toast.error(t('editor.noActiveProject'))
      return
    }

    await editor.media.removeMediaAsset({
      projectId: activeProject.metadata.id,
      id,
    })
  }

  const handleExportClip = ({ item }: { item: MediaAsset }) => {
    try {
      const downloadUrl = URL.createObjectURL(item.file)
      const linkElement = document.createElement('a')
      linkElement.href = downloadUrl
      linkElement.download = item.file.name || item.name
      document.body.append(linkElement)
      linkElement.click()
      linkElement.remove()
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)
      toast.success(t('misc.clipDownloaded'))
    } catch (error) {
      console.error('Failed to export clip:', error)
      toast.error(t('misc.clipDownloadFailed'))
    }
  }

  const addElementAtTime = ({
    asset,
    startTime,
  }: {
    asset: MediaAsset
    startTime: number
  }): boolean => {
    const element = createElementFromMedia({ asset, startTime })
    editor.timeline.insertElement({
      element,
      placement: { mode: 'auto' },
    })
    return true
  }

  const filteredMediaItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    const filtered = mediaFiles.filter(
      (item) =>
        !item.ephemeral &&
        (filterType === 'all' || item.type === filterType) &&
        (!query ||
          item.name.toLowerCase().includes(query) ||
          item.type.toLowerCase().includes(query)),
    )

    filtered.sort((a, b) => {
      let valueA: string | number
      let valueB: string | number

      switch (sortBy) {
        case 'name':
          valueA = a.name.toLowerCase()
          valueB = b.name.toLowerCase()
          break
        case 'type':
          valueA = a.type
          valueB = b.type
          break
        case 'duration':
          valueA = a.duration || 0
          valueB = b.duration || 0
          break
        case 'size':
          valueA = a.file.size
          valueB = b.file.size
          break
        default:
          return 0
      }

      if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1
      if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [mediaFiles, sortBy, sortOrder, searchQuery, filterType])

  const previewComponents = useMemo(() => {
    const previews = new Map<string, React.ReactNode>()

    filteredMediaItems.forEach((item) => {
      previews.set(item.id, <MediaPreview item={item} />)
      previews.set(
        `compact-${item.id}`,
        <MediaPreview item={item} variant="compact" />,
      )
    })

    return previews
  }, [filteredMediaItems])

  const renderPreview = (item: MediaAsset) => previewComponents.get(item.id)
  const renderCompactPreview = (item: MediaAsset) =>
    previewComponents.get(`compact-${item.id}`)

  const selectedMediaId = useMediaPreviewStore((state) => state.selectedMediaId)
  const selectedMedia = useMemo(
    () => mediaFiles.find((item) => item.id === selectedMediaId) ?? null,
    [mediaFiles, selectedMediaId],
  )

  const handleSelectMedia = ({ asset }: { asset: MediaAsset }) => {
    const store = useMediaPreviewStore.getState()
    if (store.selectedMediaId === asset.id) {
      store.clearSelection()
    } else {
      store.selectMedia({ mediaId: asset.id })
    }
  }

  const handleClearSelection = () => {
    useMediaPreviewStore.getState().clearSelection()
  }

  return (
    <>
      <input {...fileInputProps} />

      <div
        className={`relative flex h-full flex-col gap-1 ${isDragOver ? 'bg-accent/30' : ''}`}
        {...dragProps}
      >
        <div className="flex flex-col gap-2 px-3 pt-3 pb-2">
          <div className="flex items-center gap-1.5">
            <InputGroup className="flex-1">
              <InputGroupAddon>
                <InputGroupText>
                  <Search />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                placeholder={t('common.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    onClick={() => setSearchQuery('')}
                  >
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    disabled={isProcessing}
                    size="icon"
                    className="size-8 shrink-0"
                  />
                }
              >
                <CloudUpload className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openFilePicker} className="gap-2">
                  <Monitor className="size-4" />
                  {t('media.fromDevice')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsUrlDialogOpen(true)}
                  className="gap-2"
                >
                  <Link className="size-4" />
                  {t('media.fromUrl')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant={filterType !== 'all' ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                  />
                }
              >
                <Filter className="size-3.5" />
                {filterType === 'all'
                  ? t('common.all')
                  : t(`common.${filterType}`)}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => setFilterType('all')}
                  className="gap-2"
                >
                  {t('media.allTypes')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFilterType('video')}
                  className="gap-2"
                >
                  <Video className="size-4" />
                  {t('common.video')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFilterType('audio')}
                  className="gap-2"
                >
                  <Music className="size-4" />
                  {t('common.audio')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFilterType('image')}
                  className="gap-2"
                >
                  <ImageIcon className="size-4" />
                  {t('common.image')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                    className="h-7 gap-1 px-2 text-xs"
                  />
                }
              >
                <ArrowUpDown className="size-3.5" />
                {t(
                  `common.${sortBy === 'name' ? 'name' : sortBy === 'type' ? 'type' : sortBy === 'duration' ? 'duration' : 'name'}`,
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <SortMenuItem
                  label={t('common.name')}
                  sortKey="name"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={({ key }) => {
                    if (sortBy === key) {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortBy(key)
                      setSortOrder('asc')
                    }
                  }}
                />
                <SortMenuItem
                  label={t('common.type')}
                  sortKey="type"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={({ key }) => {
                    if (sortBy === key) {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortBy(key)
                      setSortOrder('asc')
                    }
                  }}
                />
                <SortMenuItem
                  label={t('common.duration')}
                  sortKey="duration"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={({ key }) => {
                    if (sortBy === key) {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortBy(key)
                      setSortOrder('asc')
                    }
                  }}
                />
                <SortMenuItem
                  label={t('media.fileSize')}
                  sortKey="size"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={({ key }) => {
                    if (sortBy === key) {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortBy(key)
                      setSortOrder('asc')
                    }
                  }}
                />
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="ml-auto flex items-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setMediaViewMode(
                            mediaViewMode === 'grid' ? 'list' : 'grid',
                          )
                        }
                        disabled={isProcessing}
                        className="size-7 shrink-0"
                      />
                    }
                  >
                    {mediaViewMode === 'grid' ? (
                      <LayoutGrid className="size-4" />
                    ) : (
                      <List className="size-4" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {mediaViewMode === 'grid'
                        ? t('projects.gridView')
                        : t('projects.listView')}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        <ScrollArea
          className="flex-1 min-h-0 w-full overflow-x-hidden"
          onClick={(event) => {
            if (event.target === event.currentTarget) handleClearSelection()
          }}
        >
          <div
            className="w-full flex-1 p-2 pt-1"
            onClick={(event) => {
              if (event.target === event.currentTarget) handleClearSelection()
            }}
          >
            {isDragOver || filteredMediaItems.length === 0 ? (
              <MediaDragOverlay
                isVisible={true}
                isProcessing={isProcessing}
                progress={progress}
                onClick={openFilePicker}
              />
            ) : mediaViewMode === 'grid' ? (
              <GridView
                items={filteredMediaItems}
                renderPreview={renderPreview}
                onRemove={handleRemove}
                onExportClip={handleExportClip}
                onAddToTimeline={addElementAtTime}
                onSelect={handleSelectMedia}
                selectedMediaId={selectedMediaId}
                highlightedId={highlightedId}
                registerElement={registerElement}
              />
            ) : (
              <ListView
                items={filteredMediaItems}
                renderPreview={renderCompactPreview}
                onRemove={handleRemove}
                onExportClip={handleExportClip}
                onAddToTimeline={addElementAtTime}
                onSelect={handleSelectMedia}
                selectedMediaId={selectedMediaId}
                highlightedId={highlightedId}
                registerElement={registerElement}
              />
            )}
          </div>
        </ScrollArea>

        {selectedMedia && (
          <MediaInfoPanel
            media={selectedMedia}
            onClose={handleClearSelection}
          />
        )}
      </div>

      <Dialog open={isUrlDialogOpen} onOpenChange={setIsUrlDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('media.importFromUrl')}</DialogTitle>
            <DialogDescription>{t('media.urlDescription')}</DialogDescription>
          </DialogHeader>
          <div>
            <Input
              placeholder={t('media.enterUrl')}
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !isUrlImporting) {
                  void handleUrlImport()
                }
              }}
              disabled={isUrlImporting}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsUrlDialogOpen(false)}
              disabled={isUrlImporting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleUrlImport}
              disabled={isUrlImporting || !urlInput.trim()}
            >
              {isUrlImporting ? t('media.importing') : t('common.import')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MediaItemWithContextMenu({
  item,
  children,
  onRemove,
  onExportClip,
}: {
  item: MediaAsset
  children: React.ReactNode
  onRemove: ({ event, id }: { event: React.MouseEvent; id: string }) => void
  onExportClip: ({ item }: { item: MediaAsset }) => void
}) {
  const t = useTranslations()

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block min-w-0 overflow-hidden">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onExportClip({ item })}>
          {t('export.clips')}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            navigator.clipboard.writeText(item.id)
            toast.success(t('timeline.mediaIdCopied'))
          }}
        >
          {t('timeline.copyMediaId')}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onClick={(event) => onRemove({ event, id: item.id })}
        >
          {t('common.delete')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function GridView({
  items,
  renderPreview,
  onRemove,
  onExportClip,
  onAddToTimeline,
  onSelect,
  selectedMediaId,
  highlightedId,
  registerElement,
}: {
  items: MediaAsset[]
  renderPreview: (item: MediaAsset) => React.ReactNode
  onRemove: ({ event, id }: { event: React.MouseEvent; id: string }) => void
  onExportClip: ({ item }: { item: MediaAsset }) => void
  onAddToTimeline: ({
    asset,
    startTime,
  }: {
    asset: MediaAsset
    startTime: number
  }) => boolean
  onSelect: ({ asset }: { asset: MediaAsset }) => void
  selectedMediaId: string | null
  highlightedId: string | null
  registerElement: (id: string, element: HTMLElement | null) => void
}) {
  return (
    <div
      className="grid gap-1.5"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
      }}
    >
      {items.map((item) => (
        <div key={item.id} ref={(el) => registerElement(item.id, el)}>
          <MediaItemWithContextMenu
            item={item}
            onRemove={onRemove}
            onExportClip={onExportClip}
          >
            <DraggableItem
              name={item.name}
              preview={renderPreview(item)}
              dragData={{
                id: item.id,
                type: 'media',
                mediaType: item.type,
                name: item.name,
              }}
              shouldShowPlusOnDrag={false}
              onAddToTimeline={({ currentTime }) =>
                onAddToTimeline({ asset: item, startTime: currentTime })
              }
              onClick={() => onSelect({ asset: item })}
              isRounded={false}
              variant="card"
              containerClassName="w-full"
              isHighlighted={highlightedId === item.id}
              isSelected={selectedMediaId === item.id}
            />
          </MediaItemWithContextMenu>
        </div>
      ))}
    </div>
  )
}

function ListView({
  items,
  renderPreview,
  onRemove,
  onExportClip,
  onAddToTimeline,
  onSelect,
  selectedMediaId,
  highlightedId,
  registerElement,
}: {
  items: MediaAsset[]
  renderPreview: (item: MediaAsset) => React.ReactNode
  onRemove: ({ event, id }: { event: React.MouseEvent; id: string }) => void
  onExportClip: ({ item }: { item: MediaAsset }) => void
  onAddToTimeline: ({
    asset,
    startTime,
  }: {
    asset: MediaAsset
    startTime: number
  }) => boolean
  onSelect: ({ asset }: { asset: MediaAsset }) => void
  selectedMediaId: string | null
  highlightedId: string | null
  registerElement: (id: string, element: HTMLElement | null) => void
}) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div
          key={item.id}
          className="overflow-hidden"
          ref={(el) => registerElement(item.id, el)}
        >
          <MediaItemWithContextMenu
            item={item}
            onRemove={onRemove}
            onExportClip={onExportClip}
          >
            <DraggableItem
              name={item.name}
              preview={
                <ListItemContent item={item} renderPreview={renderPreview} />
              }
              dragData={{
                id: item.id,
                type: 'media',
                mediaType: item.type,
                name: item.name,
              }}
              shouldShowPlusOnDrag={false}
              shouldShowLabel={false}
              onAddToTimeline={({ currentTime }) =>
                onAddToTimeline({ asset: item, startTime: currentTime })
              }
              onClick={() => onSelect({ asset: item })}
              variant="compact"
              isHighlighted={highlightedId === item.id}
              isSelected={selectedMediaId === item.id}
            />
          </MediaItemWithContextMenu>
        </div>
      ))}
    </div>
  )
}

function ListItemContent({
  item,
  renderPreview,
}: {
  item: MediaAsset
  renderPreview: (item: MediaAsset) => React.ReactNode
}) {
  const ext = item.name.includes('.')
    ? item.name.slice(item.name.lastIndexOf('.') + 1).toUpperCase()
    : item.type.toUpperCase()

  return (
    <div className="flex w-full items-center gap-2.5 overflow-hidden">
      <div className="size-10 shrink-0 overflow-hidden rounded">
        {renderPreview(item)}
      </div>
      <div className="flex w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm leading-tight" title={item.name}>
          {item.name}
        </p>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span>{ext}</span>
          {item.duration != null && item.duration > 0 && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span>{formatDuration({ duration: item.duration })}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const formatDuration = ({ duration }: { duration: number }) => {
  const min = Math.floor(duration / 60)
  const sec = Math.floor(duration % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function MediaDurationBadge({ duration }: { duration?: number }) {
  if (!duration) return null

  return (
    <div className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-xs text-white">
      {formatDuration({ duration })}
    </div>
  )
}

function MediaDurationLabel({ duration }: { duration?: number }) {
  if (!duration) return null

  return (
    <span className="text-xs opacity-70">{formatDuration({ duration })}</span>
  )
}

function MediaTypePlaceholder({
  Icon,
  label,
  duration,
  variant,
}: {
  Icon: LucideIcon
  label: string
  duration?: number
  variant: 'muted' | 'bordered'
}) {
  const iconClassName = cn('size-6', variant === 'bordered' && 'mb-1')

  return (
    <div
      className={cn(
        'text-muted-foreground flex size-full flex-col items-center justify-center rounded',
        variant === 'muted' ? 'bg-muted/30' : 'border',
      )}
    >
      <Icon className={iconClassName} />
      <span className="text-xs">{label}</span>
      <MediaDurationLabel duration={duration} />
    </div>
  )
}

function MediaPreview({
  item,
  variant = 'grid',
}: {
  item: MediaAsset
  variant?: 'grid' | 'compact'
}) {
  const t = useTranslations()
  const shouldShowDurationBadge = variant === 'grid'

  if (item.type === 'image') {
    return (
      <div className="relative flex size-full items-center justify-center">
        <Image
          src={item.url ?? ''}
          alt={item.name}
          fill
          sizes="100vw"
          className="object-cover"
          loading="lazy"
          unoptimized
        />
      </div>
    )
  }

  if (item.type === 'video') {
    if (item.thumbnailUrl) {
      return (
        <div className="relative size-full">
          <Image
            src={item.thumbnailUrl}
            alt={item.name}
            fill
            sizes="100vw"
            className="rounded object-cover"
            loading="lazy"
            unoptimized
          />
          {shouldShowDurationBadge ? (
            <MediaDurationBadge duration={item.duration} />
          ) : null}
        </div>
      )
    }

    return (
      <MediaTypePlaceholder
        Icon={Video}
        label={t('common.video')}
        duration={item.duration}
        variant="muted"
      />
    )
  }

  if (item.type === 'audio') {
    return (
      <MediaTypePlaceholder
        Icon={Music}
        label={t('common.audio')}
        duration={item.duration}
        variant="bordered"
      />
    )
  }

  return (
    <MediaTypePlaceholder
      Icon={ImageIcon}
      label={t('common.unknown')}
      variant="muted"
    />
  )
}

function SortMenuItem({
  label,
  sortKey,
  currentSortBy,
  currentSortOrder,
  onSort,
}: {
  label: string
  sortKey: 'name' | 'type' | 'duration' | 'size'
  currentSortBy: string
  currentSortOrder: 'asc' | 'desc'
  onSort: ({ key }: { key: 'name' | 'type' | 'duration' | 'size' }) => void
}) {
  const isActive = currentSortBy === sortKey
  const arrow = isActive ? (currentSortOrder === 'asc' ? '↑' : '↓') : ''

  return (
    <DropdownMenuItem onClick={() => onSort({ key: sortKey })}>
      {label} {arrow}
    </DropdownMenuItem>
  )
}

function createElementFromMedia({
  asset,
  startTime,
}: {
  asset: MediaAsset
  startTime: number
}): CreateTimelineElement {
  const duration = asset.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION

  switch (asset.type) {
    case 'video':
      return buildVideoElement({
        mediaId: asset.id,
        name: asset.name,
        duration,
        startTime,
      })
    case 'image':
      return buildImageElement({
        mediaId: asset.id,
        name: asset.name,
        duration,
        startTime,
      })
    case 'audio':
      return buildUploadAudioElement({
        mediaId: asset.id,
        name: asset.name,
        duration,
        startTime,
      })
    default:
      throw new Error(`Unsupported media type: ${asset.type}`)
  }
}
