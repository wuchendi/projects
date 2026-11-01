'use client'

import { Checkbox } from '@cdlab/ui/components/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@cdlab/ui/components/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cdlab/ui/components/popover'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

// Mirrors the bound in `schemas/link.ts` (SetTagsSchema) so a staged selection
// never exceeds what the server accepts.
const MAX_TAGS = 20

// Same set of tags, order-independent.
function sameTags(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((t) => set.has(t))
}

// Inline per-row tag editor: a "+ Add tag" trigger opening a searchable checkbox
// list of the shared tag pool. Selections are staged locally while the popover
// is open; on close, if the set changed, `onSave` persists it in one call. A
// non-matching query offers to create a new tag.
export function TagInlineEditor({
  selected,
  options,
  onSave,
  disabled,
}: {
  selected: string[]
  options: string[]
  onSave: (tags: string[]) => void
  disabled?: boolean
}) {
  const t = useTranslations('links')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<string[]>(selected)

  function handleOpenChange(next: boolean) {
    if (next) {
      // Re-seed the draft from the link's current tags each time it opens.
      setDraft(selected)
    } else {
      setQuery('')
      if (!sameTags(draft, selected)) onSave(draft)
    }
    setOpen(next)
  }

  function toggle(tag: string) {
    setDraft((d) => {
      if (d.includes(tag)) return d.filter((x) => x !== tag)
      // Cap additions; removals always allowed.
      return d.length >= MAX_TAGS ? d : [...d, tag]
    })
  }

  const q = query.trim().slice(0, 32)
  // Include staged tags (e.g. just-created) so they show as checked options.
  const pool = Array.from(new Set([...options, ...draft]))
  const filtered = q
    ? pool.filter((o) => o.toLowerCase().includes(q.toLowerCase()))
    : pool
  const canCreate = q.length > 0 && !pool.includes(q)

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          // Revealed only when the tag area is hovered (or the popover is open /
          // keyboard-focused), so the affordance stays out of the way at rest.
          className="flex items-center gap-0.5 text-primary opacity-0 transition-opacity hover:text-primary/80 focus-visible:opacity-100 disabled:opacity-50 group-hover/tag:opacity-100 data-[state=open]:opacity-100"
        >
          <Plus className="size-3.5" />
          {t('addTag')}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('tagSearch')}
          />
          <CommandList>
            {filtered.length === 0 && !canCreate && (
              <CommandEmpty>{t('noTagMatch')}</CommandEmpty>
            )}
            <CommandGroup>
              {filtered.map((tag) => (
                <CommandItem key={tag} value={tag} onSelect={() => toggle(tag)}>
                  <Checkbox checked={draft.includes(tag)} className="mr-2" />
                  <span className="flex-1 truncate">{tag}</span>
                </CommandItem>
              ))}
              {canCreate && (
                <CommandItem
                  value={`__create__${q}`}
                  onSelect={() => {
                    toggle(q)
                    setQuery('')
                  }}
                >
                  <Plus className="mr-2 size-4" />
                  {t('createTag', { tag: q })}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
