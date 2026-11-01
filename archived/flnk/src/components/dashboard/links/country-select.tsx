'use client'

import { Button } from '@cdlab/ui/components/button'
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
import { cn } from '@cdlab/ui/lib/utils'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useMemo, useState } from 'react'
import { COUNTRY_CODES, countryName, flagEmoji } from '@/lib/redirect/countries'

export function CountrySelect({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (code: string) => void
  placeholder?: string
}) {
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const options = useMemo(
    () =>
      COUNTRY_CODES.map((code) => ({
        code,
        name: countryName(code, locale),
        flag: flagEmoji(code),
      })).sort((a, b) => a.name.localeCompare(b.name)),
    [locale],
  )
  const selected = value
    ? options.find((o) => o.code === value.toUpperCase())
    : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span>
              {selected.flag} {selected.code}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>—</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.code}
                  value={`${o.code} ${o.name}`}
                  onSelect={() => {
                    onChange(o.code)
                    setOpen(false)
                  }}
                >
                  <span className="mr-2">{o.flag}</span>
                  <span className="flex-1 truncate">{o.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {o.code}
                  </span>
                  <Check
                    className={cn(
                      'ml-2 size-4',
                      selected?.code === o.code ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
