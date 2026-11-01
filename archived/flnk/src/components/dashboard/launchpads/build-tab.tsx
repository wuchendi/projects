'use client'

import { Button } from '@cdlab/ui/components/button'
import { Card } from '@cdlab/ui/components/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@cdlab/ui/components/dropdown-menu'
import { Input } from '@cdlab/ui/components/input'
import { Label } from '@cdlab/ui/components/label'
import { Switch } from '@cdlab/ui/components/switch'
import { Textarea } from '@cdlab/ui/components/textarea'
import { cn } from '@cdlab/ui/lib/utils'
import {
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  Globe,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import {
  LinkChip,
  LinkPicker,
} from '@/components/dashboard/launchpads/link-picker'
import type { LaunchpadBlock, LaunchpadConfig } from '@/database/schema'
import { buildShortUrl } from '@/lib/format/format'
import type { LinkRow } from '@/lib/platform/api'
import type { AddableBlockType } from './blocks'
import { BLOCK_TYPES, newBlock } from './blocks'

// The header is a pinned singleton (edited via HeaderCard), never a list item.
type ContentBlock = Exclude<LaunchpadBlock, { type: 'header' }>

interface BuildTabProps {
  config: LaunchpadConfig
  links: LinkRow[]
  onChange: (config: LaunchpadConfig) => void
}

export function BuildTab({ config, links, onChange }: BuildTabProps) {
  const t = useTranslations('launchpads')
  // Legacy 'header' blocks are ignored on read; any block edit writes back the
  // filtered list, dropping them from config on the next save.
  const blocks = config.blocks.filter(
    (b): b is ContentBlock => b.type !== 'header',
  )
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  function setBlocks(next: LaunchpadBlock[]) {
    onChange({ ...config, blocks: next })
  }
  function addBlock(type: AddableBlockType) {
    setBlocks([...blocks, newBlock(type)])
  }
  function updateBlock(id: string, block: ContentBlock) {
    setBlocks(blocks.map((b) => (b.id === id ? block : b)))
  }
  function removeBlock(id: string) {
    setBlocks(blocks.filter((b) => b.id !== id))
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= blocks.length || from === to) return
    const next = [...blocks]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item!)
    setBlocks(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t('build.hint')}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              {t('build.addBlock')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {BLOCK_TYPES.map((type) => (
              <DropdownMenuItem key={type} onClick={() => addBlock(type)}>
                {t(`block.type.${type}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {blocks.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('build.empty')}
        </Card>
      ) : (
        <div className="space-y-2.5">
          {blocks.map((block, index) => (
            <Card
              key={block.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) move(dragIndex, index)
                setDragIndex(null)
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn(
                'gap-0 overflow-hidden p-0',
                dragIndex === index && 'opacity-50',
                !block.enabled && 'opacity-70',
              )}
            >
              <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
                <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">
                  {t(`block.type.${block.type}`)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('build.moveUp')}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('build.moveDown')}
                  disabled={index === blocks.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Switch
                  checked={block.enabled}
                  onCheckedChange={(v) =>
                    updateBlock(block.id, { ...block, enabled: v })
                  }
                  aria-label={t('build.toggle')}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('build.remove')}
                  onClick={() => removeBlock(block.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              <div className="p-3">
                <BlockFields
                  block={block}
                  links={links}
                  onChange={(b) => updateBlock(block.id, b)}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// Destination favicon for a selected short-link row — mirrors the Links card
// avatar (DuckDuckGo icon service, Globe fallback).
function LinkFavicon({ url }: { url: string }) {
  const host = hostOf(url)
  const [failed, setFailed] = useState(false)
  return (
    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
      {host && !failed ? (
        // biome-ignore lint/performance/noImgElement: tiny external favicon, next/image not worthwhile
        <img
          src={`https://icons.duckduckgo.com/ip3/${host}.ico`}
          alt=""
          className="size-5"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <Globe className="size-4 text-muted-foreground" />
      )}
    </div>
  )
}

function BlockFields({
  block,
  links,
  onChange,
}: {
  block: ContentBlock
  links: LinkRow[]
  onChange: (block: ContentBlock) => void
}) {
  const t = useTranslations('launchpads')
  const linkById = new Map(links.map((l) => [l.id, l]))
  // Drag state for the shortlink block's reorderable link list.
  const [linkDrag, setLinkDrag] = useState<number | null>(null)

  switch (block.type) {
    case 'socials':
      return (
        <div className="space-y-2">
          {block.items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional, no stable id
            <div key={i} className="flex items-center gap-2">
              <Input
                value={item.platform}
                placeholder={t('block.socials.platform')}
                maxLength={32}
                className="w-32"
                onChange={(e) => {
                  const items = [...block.items]
                  items[i] = { ...item, platform: e.target.value }
                  onChange({ ...block, items })
                }}
              />
              <Input
                value={item.url}
                placeholder="https://…"
                maxLength={2048}
                className="flex-1"
                onChange={(e) => {
                  const items = [...block.items]
                  items[i] = { ...item, url: e.target.value }
                  onChange({ ...block, items })
                }}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('block.remove')}
                onClick={() =>
                  onChange({
                    ...block,
                    items: block.items.filter((_, j) => j !== i),
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...block,
                items: [...block.items, { platform: '', url: '' }],
              })
            }
          >
            <Plus className="size-3.5" />
            {t('block.socials.add')}
          </Button>
        </div>
      )

    case 'button':
      return (
        <div className="space-y-3">
          <Field label={t('block.button.label')}>
            <Input
              value={block.label}
              maxLength={128}
              onChange={(e) => onChange({ ...block, label: e.target.value })}
            />
          </Field>
          <Field label={t('block.button.target')}>
            <div className="flex flex-wrap items-center gap-2">
              <LinkPicker
                links={links}
                selected={
                  block.target.kind === 'link' ? [block.target.linkId] : []
                }
                onChange={(ids) =>
                  ids[0] &&
                  onChange({
                    ...block,
                    target: { kind: 'link', linkId: ids[0] },
                  })
                }
              />
              {block.target.kind === 'link' && (
                <LinkChip
                  link={linkById.get(block.target.linkId)}
                  onRemove={() =>
                    onChange({ ...block, target: { kind: 'url', url: '' } })
                  }
                />
              )}
            </div>
          </Field>
          {block.target.kind === 'url' && (
            <Field label={t('block.button.url')}>
              <Input
                value={block.target.url}
                placeholder="https://…"
                maxLength={2048}
                onChange={(e) =>
                  onChange({
                    ...block,
                    target: { kind: 'url', url: e.target.value },
                  })
                }
              />
            </Field>
          )}
        </div>
      )

    case 'shortlink': {
      // Selected links render in `linkIds` order on the public page, so the
      // list is reorderable (move up/down), mirroring the socials editor.
      const moveLink = (from: number, to: number) => {
        if (to < 0 || to >= block.linkIds.length) return
        const next = [...block.linkIds]
        const [item] = next.splice(from, 1)
        next.splice(to, 0, item!)
        onChange({ ...block, linkIds: next })
      }
      return (
        <div className="space-y-2">
          <LinkPicker
            links={links}
            selected={block.linkIds}
            multiple
            onChange={(ids) => onChange({ ...block, linkIds: ids })}
          />
          {block.linkIds.length > 0 && (
            <div className="space-y-1.5">
              {block.linkIds.map((id, i) => {
                const link = linkById.get(id)
                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={() => setLinkDrag(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (linkDrag !== null) moveLink(linkDrag, i)
                      setLinkDrag(null)
                    }}
                    onDragEnd={() => setLinkDrag(null)}
                    className={cn(
                      'flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5',
                      linkDrag === i && 'opacity-50',
                    )}
                  >
                    <GripVertical
                      className="size-4 shrink-0 cursor-grab text-muted-foreground"
                      aria-label={t('build.reorder')}
                    />
                    <LinkFavicon url={link?.url ?? ''} />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate text-sm font-medium">
                        {link
                          ? link.title || link.slug
                          : t('block.linkMissing')}
                      </p>
                      {link && (
                        <>
                          <p className="truncate text-xs font-medium text-primary">
                            {buildShortUrl(link.slug, link.domain).replace(
                              /^https?:\/\//,
                              '',
                            )}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CornerDownRight className="size-3 shrink-0" />
                            <span className="truncate">{link.url}</span>
                          </p>
                        </>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('build.moveTop')}
                      disabled={i === 0}
                      onClick={() => moveLink(i, 0)}
                    >
                      <ArrowUpToLine className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('block.remove')}
                      onClick={() =>
                        onChange({
                          ...block,
                          linkIds: block.linkIds.filter((x) => x !== id),
                        })
                      }
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    case 'image':
      return (
        <div className="space-y-3">
          <Field label={t('block.image.src')}>
            <Input
              value={block.src}
              placeholder="https://…"
              maxLength={2048}
              onChange={(e) => onChange({ ...block, src: e.target.value })}
            />
          </Field>
          <Field label={t('block.image.link')}>
            <Input
              value={block.link ?? ''}
              placeholder="https://…"
              maxLength={2048}
              onChange={(e) =>
                onChange({ ...block, link: e.target.value || undefined })
              }
            />
          </Field>
        </div>
      )

    case 'text':
      return (
        <Textarea
          value={block.text}
          maxLength={4096}
          rows={3}
          placeholder={t('block.text.placeholder')}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      )

    case 'divider':
      return (
        <p className="text-xs text-muted-foreground">
          {t('block.divider.hint')}
        </p>
      )
  }
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}
