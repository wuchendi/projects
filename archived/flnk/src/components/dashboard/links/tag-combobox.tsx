'use client'

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  useComboboxAnchor,
} from '@cdlab/ui/components/combobox'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

const MAX_TAGS = 20
const MAX_TAG_LEN = 32

// Multi-select tag picker backed by the shared tag pool. Selected tags render as
// removable chips; the dropdown lists existing tags (checkmarked) and offers to
// create the typed value when it's new. No case folding — values stored verbatim.
export function TagCombobox({
  value,
  onChange,
  suggestions,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
}) {
  const t = useTranslations('links')
  const anchor = useComboboxAnchor()
  const [input, setInput] = useState('')
  // Inside a vaul Drawer the default body portal lands outside the drawer's
  // pointer-events/focus scope, so the dropdown can't be clicked. Portal the
  // popup into the drawer content instead (falls back to body elsewhere).
  const [container, setContainer] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setContainer(
      anchor.current?.closest<HTMLElement>('[data-slot="drawer-content"]') ??
        null,
    )
  }, [anchor])

  const draft = input.trim().slice(0, MAX_TAG_LEN)
  const canCreate =
    draft.length > 0 && !suggestions.includes(draft) && !value.includes(draft)
  const items = canCreate ? [draft, ...suggestions] : suggestions

  return (
    <Combobox
      items={items}
      multiple
      value={value}
      onValueChange={(next: string[]) => {
        onChange(next.slice(0, MAX_TAGS))
        setInput('')
      }}
      inputValue={input}
      onInputValueChange={(v: string) => setInput(v)}
    >
      <ComboboxChips ref={anchor} className="w-full">
        {value.map((tag) => (
          <ComboboxChip key={tag} aria-label={tag}>
            {tag}
          </ComboboxChip>
        ))}
        <ComboboxChipsInput
          placeholder={value.length === 0 ? t('tagPlaceholder') : undefined}
        />
        <ComboboxTrigger className="ml-auto opacity-50" />
      </ComboboxChips>
      <ComboboxContent anchor={anchor} container={container}>
        <ComboboxEmpty>{t('noTagMatch')}</ComboboxEmpty>
        <ComboboxList>
          {(tag: string) => (
            <ComboboxItem key={tag} value={tag}>
              {canCreate && tag === draft ? t('createTag', { tag }) : tag}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
