'use client'

import { Badge } from '@cdlab/ui/components/badge'
import { Button } from '@cdlab/ui/components/button'
import { Input } from '@cdlab/ui/components/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cdlab/ui/components/popover'
import { ScrollArea } from '@cdlab/ui/components/scroll-area'
import { cn } from '@cdlab/ui/lib/utils'
import { Check, Link2, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import type { LinkRow } from '@/lib/platform/api'

interface LinkPickerProps {
  links: LinkRow[]
  selected: string[]
  multiple?: boolean
  onChange: (ids: string[]) => void
}

// Pick one or more existing short links by id (button/shortlink blocks store
// link references, never copied URLs). Search filters by slug / title / url.
export function LinkPicker({
  links,
  selected,
  multiple,
  onChange,
}: LinkPickerProps) {
  const t = useTranslations('launchpads')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return links
    return links.filter((l) =>
      `${l.slug} ${l.title} ${l.url}`.toLowerCase().includes(q),
    )
  }, [links, search])

  function toggle(id: string) {
    if (!multiple) {
      onChange([id])
      setOpen(false)
      return
    }
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          {multiple ? t('block.shortlink.add') : t('block.button.pickLink')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="border-b p-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('block.linkSearch')}
            className="h-8"
          />
        </div>
        <ScrollArea className="h-64">
          {filtered.length === 0 ? (
            <p className="p-3 text-center text-sm text-muted-foreground">
              {t('block.noLinks')}
            </p>
          ) : (
            <div className="space-y-1 p-1">
              {filtered.map((link) => {
                const active = selected.includes(link.id)
                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => toggle(link.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                      active && 'bg-accent',
                    )}
                  >
                    <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {link.title || link.slug}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        /{link.slug}
                      </span>
                    </span>
                    {active && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

// Compact read-only chip for a selected link reference.
export function LinkChip({
  link,
  onRemove,
}: {
  link: LinkRow | undefined
  onRemove: () => void
}) {
  return (
    <Badge variant="secondary" className="gap-1">
      <Link2 className="size-3" />
      {link ? link.title || link.slug : '—'}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 text-muted-foreground hover:text-foreground"
      >
        ×
      </button>
    </Badge>
  )
}
