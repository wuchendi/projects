'use client'

import { Button } from '@cdlab/ui/components/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@cdlab/ui/components/card'
import { Field, FieldTitle } from '@cdlab/ui/components/field'
import { Input } from '@cdlab/ui/components/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '@cdlab/ui/components/input-group'
import { Slider } from '@cdlab/ui/components/slider'
import { ToggleGroup, ToggleGroupItem } from '@cdlab/ui/components/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@cdlab/ui/components/tooltip'
import { formatBytes } from '@cdlab/utils'
import {
  CircleQuestionMark,
  ClipboardPaste,
  CornerDownLeft,
  HardDriveDownload,
  Link,
  Loader2,
  Trash2,
  TvMinimalPlay,
  X,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { selectIsParsed, useDownloadStore } from '@/stores/download-store'

const BYPLAY_URL = 'https://byplay.pages.dev'

type DownloadFormat = 'ts' | 'mp4' | 'stream-ts' | 'stream-mp4'

interface SourceCardProps {
  headerAction?: React.ReactNode
  actions: {
    parseM3U8: (url?: string) => Promise<void>
    selectVariant: (variant: any) => Promise<void>
    addToQueue: (isGetMP4: boolean, saveAsStream: boolean) => Promise<void>
    directDownload: () => Promise<void>
    cancelDownload: () => void
  }
}

export function SourceCard({ headerAction, actions }: SourceCardProps) {
  const t = useTranslations()
  const locale = useLocale()

  const url = useDownloadStore((s) => s.url)
  const setUrl = useDownloadStore((s) => s.setUrl)
  const customFileName = useDownloadStore((s) => s.customFileName)
  const setCustomFileName = useDownloadStore((s) => s.setCustomFileName)
  const isParsing = useDownloadStore((s) => s.isParsing)
  const isLoadingVariant = useDownloadStore((s) => s.isLoadingVariant)
  const downloadState = useDownloadStore((s) => s.downloadState)
  const variants = useDownloadStore((s) => s.variants)
  const tsUrlList = useDownloadStore((s) => s.tsUrlList)
  const isDirectVideo = useDownloadStore((s) => s.isDirectVideo)
  const rangeDownload = useDownloadStore((s) => s.rangeDownload)
  const estimatedSize = useDownloadStore((s) => s.estimatedSize)
  const isStreamSupported = useDownloadStore((s) => s.isStreamSupported)
  const setRangeDownload = useDownloadStore((s) => s.setRangeDownload)
  const isParsed = useDownloadStore(selectIsParsed)

  const [format, setFormat] = useState<DownloadFormat>('mp4')

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) return
      setUrl(text.trim())
    } catch {
      toast.error(t('batch.clipboardError'))
    }
  }, [setUrl, t])

  const handleDownload = () => {
    void actions.addToQueue(
      format === 'mp4' || format === 'stream-mp4',
      format.startsWith('stream-'),
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('tool.title')}</CardTitle>
        <CardDescription>{t('tool.description')}</CardDescription>
        {headerAction && <CardAction>{headerAction}</CardAction>}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* URL input — InputGroup style */}
        <InputGroup>
          <InputGroupAddon align="block-start" className="border-b">
            <InputGroupText className="font-mono font-medium">
              <Link className="size-4" />
              {t('parse.videoUrlLabel')}
            </InputGroupText>
            <div className="flex items-center gap-0.5 ml-auto">
              <InputGroupButton
                size="icon-xs"
                onClick={() => void handlePaste()}
                disabled={downloadState.isDownloading}
              >
                <ClipboardPaste />
              </InputGroupButton>
              {url.trim() && (
                <InputGroupButton size="icon-xs" onClick={() => setUrl('')}>
                  <Trash2 />
                </InputGroupButton>
              )}
              {url.trim() && (
                <InputGroupButton size="icon-xs" asChild>
                  <a
                    href={`${BYPLAY_URL}/${locale}?url=${encodeURIComponent(url.trim())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <TvMinimalPlay />
                  </a>
                </InputGroupButton>
              )}
            </div>
          </InputGroupAddon>
          <InputGroupInput
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void actions.parseM3U8()
            }}
            disabled={downloadState.isDownloading}
            placeholder={t('parse.videoPlaceholder')}
          />
          <InputGroupAddon align="block-end" className="border-t">
            <InputGroupText />
            <InputGroupButton
              size="sm"
              className="ml-auto"
              variant="default"
              onClick={() => void actions.parseM3U8()}
              disabled={isParsing || downloadState.isDownloading || !url.trim()}
            >
              {isParsing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('parse.parsing')}
                </>
              ) : (
                <>
                  {t('parse.parse')}
                  <CornerDownLeft />
                </>
              )}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>

        {/* Direct video info */}
        {isDirectVideo && estimatedSize !== null && (
          <Field>
            <FieldTitle>
              {t('download.fileInfo')}
              <span className="text-sm text-muted-foreground">
                {formatBytes({ bytes: estimatedSize })}
              </span>
            </FieldTitle>
          </Field>
        )}

        {/* Parsed config — same compact style as batch */}
        {isParsed && !isDirectVideo && (
          <div className="space-y-2.5">
            {/* Variant */}
            {variants.length > 0 && (
              <Field>
                <FieldTitle>{t('batch.variant')}</FieldTitle>
                <ToggleGroup
                  type="single"
                  size="sm"
                  spacing={1}
                  variant="outline"
                  value={variants.find((v) => v.selected)?.url || ''}
                  onValueChange={(v) => {
                    if (v) {
                      const variant = variants.find((item) => item.url === v)
                      if (variant) void actions.selectVariant(variant)
                    }
                  }}
                  className="flex-wrap"
                >
                  {variants.map((v) => (
                    <ToggleGroupItem
                      key={v.url}
                      value={v.url}
                      disabled={isLoadingVariant || downloadState.isDownloading}
                    >
                      {v.name}
                      {v.resolution && ` ${v.resolution}`}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
            )}

            <Field>
              <FieldTitle>
                {t('batch.format')}
                {(format === 'stream-mp4' || format === 'stream-ts') && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <CircleQuestionMark className="size-3.5 cursor-help text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          {t('download.streamTooltip')}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </FieldTitle>
              <ToggleGroup
                type="single"
                size="sm"
                spacing={1}
                variant="outline"
                value={format}
                onValueChange={(v) => {
                  if (v) setFormat(v as DownloadFormat)
                }}
                className="flex-wrap"
              >
                <ToggleGroupItem value="mp4">MP4</ToggleGroupItem>
                <ToggleGroupItem value="ts">.ts</ToggleGroupItem>
                {isStreamSupported && (
                  <>
                    <ToggleGroupItem value="stream-mp4">
                      {t('batch.streamMp4Short')}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="stream-ts">
                      {t('batch.streamTsShort')}
                    </ToggleGroupItem>
                  </>
                )}
              </ToggleGroup>
            </Field>

            {/* Filename */}
            <Field>
              <FieldTitle>{t('filename.label')}</FieldTitle>
              <Input
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                disabled={downloadState.isDownloading}
                placeholder={t('filename.placeholder')}
              />
            </Field>

            {/* Range */}
            {tsUrlList.length > 1 && (
              <Field>
                <div className="flex items-center justify-between">
                  <FieldTitle>
                    {t('batch.range')}
                    <span className="text-muted-foreground font-normal">
                      ({tsUrlList.length} seg
                      {estimatedSize !== null &&
                        ` · ${formatBytes({ bytes: estimatedSize })}`}
                      )
                    </span>
                  </FieldTitle>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {rangeDownload.startSegment} ~ {rangeDownload.endSegment}
                  </span>
                </div>
                <Slider
                  value={[
                    parseInt(rangeDownload.startSegment) || 1,
                    parseInt(rangeDownload.endSegment) || tsUrlList.length,
                  ]}
                  onValueChange={(value) =>
                    setRangeDownload({
                      startSegment: String(value[0]),
                      endSegment: String(value[1]),
                    })
                  }
                  min={1}
                  max={tsUrlList.length}
                  step={1}
                  disabled={downloadState.isDownloading}
                />
              </Field>
            )}
          </div>
        )}

        {/* Filename for direct video */}
        {isDirectVideo && (
          <Field>
            <FieldTitle>{t('filename.label')}</FieldTitle>
            <Input
              value={customFileName}
              onChange={(e) => setCustomFileName(e.target.value)}
              disabled={downloadState.isDownloading}
              placeholder={t('filename.placeholder')}
            />
          </Field>
        )}
      </CardContent>

      {(isParsed || isDirectVideo) && (
        <CardFooter className="gap-2">
          {!downloadState.isDownloading ? (
            isDirectVideo ? (
              <Button onClick={() => void actions.directDownload()}>
                <HardDriveDownload className="size-4" />
                {t('download.directDownload')}
              </Button>
            ) : (
              <Button onClick={handleDownload}>
                <HardDriveDownload className="size-4" />
                {t('download.addToQueue')}
              </Button>
            )
          ) : (
            <Button variant="destructive" onClick={actions.cancelDownload}>
              <X className="size-4" />
              {t('download.cancel')}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
