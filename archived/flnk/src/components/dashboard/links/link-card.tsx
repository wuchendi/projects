'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import { Card } from '@cdlab/ui/components/card'
import { Checkbox } from '@cdlab/ui/components/checkbox'
import { CopyButton } from '@cdlab/ui/components/copy-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@cdlab/ui/components/dropdown-menu'
import { cn } from '@cdlab/ui/lib/utils'
import {
  BarChart3,
  Calendar as CalendarIcon,
  CornerDownRight,
  ExternalLink,
  Globe,
  MoreHorizontal,
  Pencil,
  Power,
  PowerOff,
  QrCode,
  Tag,
  Trash2,
  User,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { KeyboardEvent } from 'react'
import { useState } from 'react'
import { QrPopover } from '@/components/dashboard/links/qr-popover'
import { TagInlineEditor } from '@/components/dashboard/links/tag-inline-editor'
import { buildShortUrl, configBadges, formatDate } from '@/lib/format/format'
import type { LinkRow } from '@/lib/platform/api'

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// Fire a click-equivalent handler when a non-button element is activated via
// the keyboard (Enter / Space) so clickable badges stay operable.
function onActivateKey(handler: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handler()
    }
  }
}

// Destination favicon for the row avatar. Fetched from DuckDuckGo's icon
// service (more privacy-respecting than Google's) and only from the admin
// dashboard; falls back to a Globe glyph when the host has no icon.
function LinkFavicon({ url }: { url: string }) {
  const host = hostOf(url)
  const [failed, setFailed] = useState(false)
  return (
    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
      {host && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        // biome-ignore lint/performance/noImgElement: tiny external favicon, next/image not worthwhile
        <img
          src={`https://icons.duckduckgo.com/ip3/${host}.ico`}
          alt=""
          className="size-6"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <Globe className="size-5 text-muted-foreground" />
      )}
    </div>
  )
}

interface LinkCardProps {
  link: LinkRow
  view: 'list' | 'grid'
  selected: boolean
  count: number
  // Currently-active tag filters, used to highlight matching row badges.
  selectedTags: string[]
  // All known tag names, offered as inline-editor options.
  tagOptions: string[]
  inlineTagPending: boolean
  toggleDisabledPending: boolean
  onToggleSelect: (id: string, on: boolean) => void
  onToggleTag: (tag: string) => void
  onInlineTagSave: (id: string, tags: string[]) => void
  onEdit: (link: LinkRow) => void
  onDelete: (link: LinkRow) => void
  onToggleDisabled: (link: LinkRow) => void
  onViewAnalytics: (slug: string) => void
}

export function LinkCard({
  link,
  view,
  selected,
  count,
  selectedTags,
  tagOptions,
  inlineTagPending,
  toggleDisabledPending,
  onToggleSelect,
  onToggleTag,
  onInlineTagSave,
  onEdit,
  onDelete,
  onToggleDisabled,
  onViewAnalytics,
}: LinkCardProps) {
  const t = useTranslations('links')
  const tc = useTranslations('common')
  const locale = useLocale()

  const shortUrl = buildShortUrl(link.slug, link.domain)
  const shortLabel = shortUrl.replace(/^https?:\/\//, '')
  const disabled = Boolean(link.config.disabled)
  const title =
    link.title?.trim() ||
    link.config.title?.trim() ||
    hostOf(link.url) ||
    link.slug

  const checkbox = (
    <Checkbox
      checked={selected}
      onCheckedChange={(v) => onToggleSelect(link.id, v === true)}
      aria-label={link.slug}
    />
  )

  const titleBlock = (
    <div className="flex min-w-0 items-center gap-2">
      <h3 className="truncate font-semibold leading-tight">{title}</h3>
      {disabled && (
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {t('disabled')}
        </Badge>
      )}
    </div>
  )

  const shortBlock = (
    <div className="flex items-center gap-1.5">
      <a
        href={shortUrl}
        target="_blank"
        rel="noreferrer"
        className="truncate text-sm font-medium text-primary hover:underline"
      >
        {shortLabel}
      </a>
      <CopyButton
        value={shortUrl}
        size="icon-xs"
        aria-label={tc('copy')}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      />
    </div>
  )

  const destBlock = (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <CornerDownRight className="size-3.5 shrink-0" />
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer"
        className="truncate hover:underline"
      >
        {link.url}
      </a>
    </div>
  )

  const metaBlock = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => onViewAnalytics(link.slug)}
        className="flex items-center gap-1 transition-colors hover:text-foreground"
      >
        <BarChart3 className="size-3.5" />
        {t('clicksCount', { count })}
      </button>
      <span className="flex items-center gap-1">
        <CalendarIcon className="size-3.5" />
        {formatDate(link.createdAt, locale)}
      </span>
      {link.createdBy && (
        <span className="flex items-center gap-1">
          <User className="size-3.5" />
          <span className="max-w-[12rem] truncate">{link.createdBy}</span>
        </span>
      )}
      <span className="group/tag flex items-center gap-1.5">
        <Tag className="size-3.5 shrink-0" />
        {link.tags.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {link.tags.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? 'default' : 'secondary'}
                role="button"
                tabIndex={0}
                className="cursor-pointer px-1.5 py-0 text-[10px] font-normal"
                onClick={() => onToggleTag(tag)}
                onKeyDown={onActivateKey(() => onToggleTag(tag))}
              >
                {tag}
              </Badge>
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground/70">{t('noTags')}</span>
        )}
        <TagInlineEditor
          selected={link.tags}
          options={tagOptions}
          disabled={inlineTagPending}
          onSave={(nextTags) => onInlineTagSave(link.id, nextTags)}
        />
      </span>
      {configBadges(link.config).map((b) => (
        <Badge
          key={b}
          variant="outline"
          className="px-1.5 py-0 text-[10px] font-normal"
        >
          {b}
        </Badge>
      ))}
    </div>
  )

  const actions = (
    <div className="flex shrink-0 items-center gap-0.5">
      <QrPopover url={shortUrl} slug={link.slug} qr={link.config.qr}>
        <Button variant="ghost" size="icon" aria-label={t('qr.title')}>
          <QrCode className="size-4" />
        </Button>
      </QrPopover>
      <Button
        variant="ghost"
        size="icon"
        aria-label={tc('edit')}
        onClick={() => onEdit(link)}
      >
        <Pencil className="size-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('table.actions')}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-36" align="end">
          <DropdownMenuItem asChild>
            <a href={shortUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              {tc('open')}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onViewAnalytics(link.slug)}>
            <BarChart3 className="size-4" />
            {t('viewAnalytics')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={toggleDisabledPending}
            onClick={() => onToggleDisabled(link)}
          >
            {disabled ? (
              <Power className="size-4" />
            ) : (
              <PowerOff className="size-4" />
            )}
            {disabled ? t('enable') : t('disable')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(link)}
          >
            <Trash2 className="size-4" />
            {tc('delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  if (view === 'grid') {
    return (
      <Card
        className={cn(
          'flex flex-col gap-2 border p-4 transition-all hover:border-primary/60 hover:shadow-xl',
          disabled && 'opacity-60',
          selected && 'border-primary/60 ring-1 ring-primary/30',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {checkbox}
            <LinkFavicon url={link.url} />
          </div>
          {actions}
        </div>
        {titleBlock}
        {shortBlock}
        {destBlock}
        <div className="mt-auto pt-1">{metaBlock}</div>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        'flex flex-row items-start gap-3 border p-4 transition-all hover:border-primary/60 hover:shadow-xl',
        disabled && 'opacity-60',
        selected && 'border-primary/60 ring-1 ring-primary/30',
      )}
    >
      <div className="pt-1">{checkbox}</div>
      <LinkFavicon url={link.url} />
      <div className="min-w-0 flex-1 space-y-1.5">
        {/* Header: identity on the left, actions pinned top-right. */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1.5">
            {titleBlock}
            {shortBlock}
          </div>
          {actions}
        </div>
        {/* Body spans the full width below the header. */}
        {destBlock}
        {metaBlock}
      </div>
    </Card>
  )
}
