'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Field, FieldTitle } from '@cdlab/ui/components/field'
import { Input } from '@cdlab/ui/components/input'
import { Slider } from '@cdlab/ui/components/slider'
import { ToggleGroup, ToggleGroupItem } from '@cdlab/ui/components/toggle-group'
import { formatBytes } from '@cdlab/utils'
import { Check, Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { VariantStream } from '@/lib'
import type { BatchFormat, BatchItem, BatchStatus } from '@/stores/batch-store'

interface BatchItemRowProps {
  item: BatchItem
  index: number
  disabled: boolean
  isStreamSupported: boolean
  onRemove: (id: number) => void
  onUpdate: (id: number, patch: Partial<BatchItem>) => void
  onVariantChange: (item: BatchItem, variantUrl: string) => void
}

export function BatchItemRow({
  item,
  index,
  disabled,
  isStreamSupported,
  onRemove,
  onUpdate,
  onVariantChange,
}: BatchItemRowProps) {
  const t = useTranslations()
  const isParsed = item.status === 'parsed'
  const hasVariants = (item.meta?.variants?.length ?? 0) > 0
  const segCount = item.meta?.segmentCount ?? 0

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm py-2 px-3 bg-muted/30">
        <span className="text-xs text-muted-foreground tabular-nums shrink-0 text-right">
          {index + 1}
        </span>
        <StatusIndicator status={item.status} />
        <span className="truncate flex-1 font-mono text-xs">{item.url}</span>
        {isParsed && segCount > 0 && (
          <Badge variant="outline" className="text-[10px] shrink-0 h-5">
            {segCount} seg
          </Badge>
        )}
        {item.meta?.isDirectVideo && (
          <Badge variant="outline" className="text-[10px] shrink-0 h-5">
            {item.meta.directExt.toUpperCase()}
            {item.meta.estimatedSize
              ? ` · ${formatBytes({ bytes: item.meta.estimatedSize })}`
              : ''}
          </Badge>
        )}
        {isParsed &&
          !item.meta?.isDirectVideo &&
          item.meta?.estimatedSize != null && (
            <Badge variant="outline" className="text-[10px] shrink-0 h-5">
              ~{formatBytes({ bytes: item.meta.estimatedSize })}
            </Badge>
          )}
        {item.status !== 'downloading' && item.status !== 'done' && (
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Done */}
      {item.status === 'done' && (
        <div className="px-3 py-1.5 bg-emerald-500/5 border-t flex items-center gap-1.5">
          <Check className="size-3 text-emerald-500" />
          <span className="text-xs text-emerald-600">
            {t('batch.status.done')}
          </span>
        </div>
      )}

      {/* Error */}
      {item.status === 'error' && (
        <div className="px-3 py-1.5 bg-red-500/5 border-t">
          <span className="text-xs text-red-500">
            {t('batch.status.error')}
          </span>
        </div>
      )}

      {/* Config */}
      {isParsed && (
        <div className="border-t px-3 py-3 space-y-2.5 bg-background/50">
          {hasVariants && (
            <Field>
              <FieldTitle>{t('batch.variant')}</FieldTitle>
              <ToggleGroup
                type="single"
                size="sm"
                spacing={1}
                variant="outline"
                value={item.selectedVariantUrl}
                onValueChange={(v) => {
                  if (v) void onVariantChange(item, v)
                }}
                className="flex-wrap"
              >
                {item.meta!.variants.map((v: VariantStream) => (
                  <ToggleGroupItem key={v.url} value={v.url}>
                    {v.name}
                    {v.resolution && ` ${v.resolution}`}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          )}

          {/* Format — buttons */}
          <Field>
            <FieldTitle>{t('batch.format')}</FieldTitle>
            <ToggleGroup
              type="single"
              size="sm"
              spacing={1}
              variant="outline"
              value={item.format}
              onValueChange={(v) => {
                if (v) onUpdate(item.id, { format: v as BatchFormat })
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
              value={item.customName}
              onChange={(e) =>
                onUpdate(item.id, { customName: e.target.value })
              }
              placeholder={t('filename.placeholder')}
            />
          </Field>

          {/* Range */}
          {segCount > 1 && (
            <Field>
              <div className="flex items-center justify-between">
                <FieldTitle>
                  {t('batch.range')}
                  <span className="text-muted-foreground font-normal">
                    ({segCount} seg
                    {item.meta?.estimatedSize != null &&
                      ` · ${formatBytes({ bytes: item.meta.estimatedSize })}`}
                    )
                  </span>
                </FieldTitle>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {item.rangeStart} ~ {item.rangeEnd}
                </span>
              </div>
              <Slider
                value={[item.rangeStart, item.rangeEnd]}
                onValueChange={([s, e]) =>
                  onUpdate(item.id, { rangeStart: s, rangeEnd: e })
                }
                min={1}
                max={segCount}
                step={1}
              />
            </Field>
          )}
        </div>
      )}
    </div>
  )
}

function StatusIndicator({ status }: { status: BatchStatus }) {
  if (status === 'done')
    return <Check className="size-3.5 text-emerald-500 shrink-0" />
  if (status === 'downloading' || status === 'parsing')
    return <Loader2 className="size-3.5 text-blue-500 animate-spin shrink-0" />
  if (status === 'error')
    return <X className="size-3.5 text-red-500 shrink-0" />
  if (status === 'parsed')
    return <span className="size-2 rounded-full bg-sky-400 shrink-0" />
  return (
    <span className="size-2 rounded-full bg-muted-foreground/30 shrink-0" />
  )
}
